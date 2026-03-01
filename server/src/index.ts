import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser } from './middleware/validateToken.js';
import type { CustomRequest } from './middleware/validateToken.js';
import { User } from './models/User.js';
// Registration
import { registerValidation, loginValidation, handleValidation } from './validators/inputValidation.js';
import bcrypt from "bcryptjs";
// Token
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
// Connect React with Node.js
import cors from 'cors';
import type { CorsOptions } from 'cors';
// File management
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { File } from './models/File.js'; 
import { Comment } from './models/Comment.js';
import { Folder } from './models/Folder.js';

// Reading .docx and .pdf
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';

dotenv.config({ path: '../.env' });

const app = express();
const port = 3000;

app.use(express.json());

if (process.env.NODE_ENV === 'development') {
    const corsOptions: CorsOptions = {
        origin: 'http://localhost:3000',
        optionsSuccessStatus: 200
    }

    app.use(cors(corsOptions))

}

console.log("Server is running");

const mongoDB: string = "mongodb://127.0.0.1:27017/testdb"
mongoose.connect(mongoDB)
mongoose.Promise = Promise
const db = mongoose.connection

db.on("error", console.error.bind(console, "MongoDB connection error"))

// Clear all stale locks and waiting queues on server startup
// This prevents files staying locked forever if the server crashed/restarted
db.once("open", async () => {
    try {
        const result = await File.updateMany(
            { $or: [{ isLocked: true }, { 'waitingQueue.0': { $exists: true } }] },
            { $set: { isLocked: false, forceUnlocked: false, waitingQueue: [] }, $unset: { lockedBy: 1, lockedAt: 1 } }
        );
        if (result.modifiedCount > 0) {
            console.log(`Cleared ${result.modifiedCount} stale lock(s) on startup.`);
        }
    } catch (err) {
        console.error("Failed to clear stale locks on startup:", err);
    }
});

// File filter to allow text files and images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('text/') || file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only text files and images are allowed!'));
    }
};


// Default Multer setup (similar to lectures)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userId = (req as any).user._id; // Access user ID from auth middleware
        const uploadPath = path.join('uploads', userId.toString()); // new uploads folder created with userID

        // Creating user folder if it doesn't exist.
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Generate unique filename to avoid conflicts. 
        // 1E9 = 1 Billion random number + Date + name of file = impossible to have the same filename.
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
  })

const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit to avoid ruining my computer
    fileFilter
})


// help from Claude with this function to keep the initial structure.
function htmlToEditorBlocks(html: string) {
    const $ = cheerio.load(html);
    const blocks: any[] = [];

    const getFormattedText = (el: any) => {
        let text = $(el).html() || '';
        text = text.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
        text = text.replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>');
        return text.trim();
    };

    // Recursively convert a <ul> or <ol> element into EditorJS nested list items
    const parseListItems = ($list: any): any[] => {
        return $list.children('li').map((_: any, li: any) => {
            const $li = $(li);

            // Grab inline HTML of the li (excluding nested ul/ol)
            const $clone = $li.clone();
            $clone.find('ul, ol').remove();
            let text = $clone.html() || '';
            text = text.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
            text = text.replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>');
            text = text.trim();

            // Check for nested lists
            const $nestedList = $li.children('ul, ol').first();
            const nestedItems = $nestedList.length > 0 ? parseListItems($nestedList) : [];

            return { content: text, items: nestedItems };
        }).get();
    };

    $('body').children().each((_: any, element: any) => {
        const el = $(element);
        const tag = element.tagName.toLowerCase();

        const getText = () => el.text().trim();

        if (tag === 'h1') {
            blocks.push({ type: 'header', data: { text: getText(), level: 1 } });
        } else if (tag === 'h2') {
            blocks.push({ type: 'header', data: { text: getText(), level: 2 } });
        } else if (tag === 'h3') {
            blocks.push({ type: 'header', data: { text: getText(), level: 3 } });
        } else if (tag === 'h4') {
            blocks.push({ type: 'header', data: { text: getText(), level: 4 } });
        } else if (tag === 'h5') {
            blocks.push({ type: 'header', data: { text: getText(), level: 5 } });
        } else if (tag === 'h6') {
            blocks.push({ type: 'header', data: { text: getText(), level: 6 } });
        } else if (tag === 'ul') {
            const items = parseListItems(el);
            if (items.length > 0) {
                blocks.push({ type: 'list', data: { style: 'unordered', items } });
            }
        } else if (tag === 'ol') {
            const items = parseListItems(el);
            if (items.length > 0) {
                blocks.push({ type: 'list', data: { style: 'ordered', items } });
            }
        } else if (tag === 'table') {
            const rows: string[][] = [];
            let withHeadings = false;

            const thead = el.find('thead');
            if (thead.length > 0) {
                withHeadings = true;
                thead.find('tr').each((_: any, tr: any) => {
                    const row = $(tr).find('th, td').map((_: any, cell: any) => $(cell).text().trim()).get();
                    if (row.length > 0) rows.push(row);
                });
            }

            el.find('tbody tr, tr').each((_: any, tr: any) => {
                if ($(tr).closest('thead').length > 0) return;
                const row = $(tr).find('td, th').map((_: any, cell: any) => $(cell).text().trim()).get();
                if (row.length > 0) rows.push(row);
            });

            if (rows.length > 0) {
                blocks.push({ type: 'table', data: { withHeadings, content: rows } });
            }
        } else if (tag === 'blockquote') {
            const text = getFormattedText(element);
            if (text) {
                blocks.push({ type: 'quote', data: { text, caption: '', alignment: 'left' } });
            }
        } else if (tag === 'pre' || tag === 'code') {
            const code = el.text().trim();
            if (code) {
                blocks.push({ type: 'code', data: { code } });
            }
        } else if (tag === 'hr') {
            blocks.push({ type: 'delimiter', data: {} });
        } else if (tag === 'img') {
            const src = el.attr('src');
            const alt = el.attr('alt') || '';
            if (src) {
                blocks.push({
                    type: 'image',
                    data: { file: { url: src }, caption: alt, withBorder: false, stretched: false, withBackground: false }
                });
            }
        } else if (tag === 'p') {
            const text = getFormattedText(element);
            if (text) {
                blocks.push({ type: 'paragraph', data: { text } });
            }
        } else if (tag === 'div') {
            // Recurse into divs — mammoth sometimes wraps lists inside divs
            $(element).children().each((_: any, child: any) => {
                const childTag = child.tagName?.toLowerCase();
                if (childTag === 'ul' || childTag === 'ol') {
                    const style = childTag === 'ol' ? 'ordered' : 'unordered';
                    const items = parseListItems($(child));
                    if (items.length > 0) {
                        blocks.push({ type: 'list', data: { style, items } });
                    }
                } else {
                    const text = getFormattedText(child);
                    if (text) blocks.push({ type: 'paragraph', data: { text } });
                }
            });
        }
    });

    return blocks.length > 0 ? blocks : [{ type: 'paragraph', data: { text: '' } }];
}

const profilePicStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join('uploads', 'profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const userId = (req as any).user._id;
        cb(null, `${userId}${path.extname(file.originalname)}`);
    }
});

const profilePicFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

const uploadProfilePic = multer({
    storage: profilePicStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: profilePicFilter
});

app.use('/uploads/profiles', express.static(path.join(process.cwd(), 'uploads', 'profiles')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Upload profile picture
app.post('/api/users/profile-picture', authenticateUser, uploadProfilePic.single('profilePicture'), async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const userId = (req as any).user._id;

        const user = await User.findById(userId);
        if (user?.profilePicture) {
            const oldPath = path.join(process.cwd(), user.profilePicture);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        // Store only the filename, not the full path
        const filename = file.filename;
        await User.findByIdAndUpdate(userId, { profilePicture: filename });

        res.json({ message: 'Profile picture updated', profilePicture: `/uploads/profiles/${filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

// Get current user profile
app.get('/api/users/me', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const user = await User.findById(userId).select('username email profilePicture');
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            username: user.username,
            email: user.email,
            // Build the full URL path from just the stored filename
            profilePicture: user.profilePicture ? `/uploads/profiles/${user.profilePicture}` : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

app.post('/api/files/upload', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const userId = (req as any).user._id;
        const fileExtension = file.originalname.split('.').pop()?.toLowerCase();

        let content = '';

        // Extract text from PDF or DOCX
        if (fileExtension === 'pdf') {
            try {
                const buffer = fs.readFileSync(file.path);
                const parser = new PDFParse({ data: buffer });
                const result = await parser.getText();
                content = result.text;
            } catch (error) {
                console.error('PDF parsing error:', error);
                content = '[Error: Could not parse PDF file.]';
            }
        } else if (fileExtension === 'docx') {
            try {
                const result = await mammoth.convertToHtml({ path: file.path });
                const blocks = htmlToEditorBlocks(result.value);

                const editorData = {
                    time: Date.now(),
                    blocks: blocks.length > 0 ? blocks : [{ type: 'paragraph', data: { text: '' } }],
                    version: '2.28.0'
                };

                // Delete the original DOCX file
                fs.unlinkSync(file.path);
                
                // Save as .txt with proper EditorJS format
                const newFileName = file.filename.replace(/\.[^/.]+$/, '.txt');
                const newFilePath = path.join(file.destination, newFileName);
                fs.writeFileSync(newFilePath, JSON.stringify(editorData), 'utf8');

                const newFile = new File({
                    filename: newFileName,
                    originalName: file.originalname.replace(/\.[^/.]+$/, '.txt'),
                    path: newFilePath,
                    size: fs.statSync(newFilePath).size,
                    userId,
                    folder: (req.body.folder as string) || '/',
                    uploadDate: new Date(),
                });

                await newFile.save();
                return res.status(200).json({ message: 'File uploaded and converted successfully', file: newFile });
            } catch (error) {
                console.error('DOCX parsing error:', error);
                return res.status(500).json({ error: 'Failed to process DOCX file' });
            }
        }

        // Convert PDF/DOCX to EditorJS JSON and save as .txt
        if (fileExtension === 'pdf' || fileExtension === 'docx') {
            const editorData = {
                time: Date.now(),
                blocks: content.split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => ({
                        type: 'paragraph',
                        data: { text: line.trim() }
                    })),
                version: '2.28.0'
            };

            const absoluteFilePath = path.resolve(file.path);
            // console.log('Trying to delete:', absoluteFilePath);
            // console.log('File exists:', fs.existsSync(absoluteFilePath));

            if (fs.existsSync(absoluteFilePath)) {
                fs.unlinkSync(absoluteFilePath);
            } else {
                // console.error('File not found at path:', absoluteFilePath);
            }

            const newFileName = file.filename.replace(/\.[^/.]+$/, '.txt');
            const newFilePath = path.resolve(file.destination, newFileName);
            fs.writeFileSync(newFilePath, JSON.stringify(editorData), 'utf8');

            const newFile = new File({
                filename: newFileName,
                originalName: file.originalname.replace(/\.[^/.]+$/, '.txt'), // treat as txt
                path: newFilePath,
                size: fs.statSync(newFilePath).size,
                userId,
                folder: (req.body.folder as string) || '/',
                uploadDate: new Date(),
            });

            await newFile.save();
            return res.status(200).json({ message: 'File uploaded and converted successfully', file: newFile });
        }

        const newFile = new File({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            userId,
            folder: (req.body.folder as string) || '/',
            uploadDate: new Date(),
        });

        await newFile.save();
        res.status(200).json({ message: 'File uploaded successfully', file: newFile });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

app.post('/api/auth/register', registerValidation, handleValidation, async (req: Request, res: Response) => {
    try {
        const { email, password, username, isAdmin } = req.body;

        const emailUsed = await User.findOne({email});
        if(emailUsed) {
            return res.status(403).json({ error: "Email is already in use"});
        }
        const usernameUsed = await User.findOne({username});
        if(usernameUsed) {
            return res.status(403).json({ error: "Username is already in use"}); // besides email, username also needs to be unique.
        }
        const hashedPassword = await bcrypt.hash(password, 10) // using bcrypt to turn password123 into auhw3hyuwSHDAHUKE#!@#!U*832. 10 for more protection

        const newUser = new User({ email, password: hashedPassword, username, isAdmin: Boolean(isAdmin)});
        await newUser.save();

        res.status(201).json({message: "User added successfully!"});

    } catch (error) {
        res.status(500).json({ error: "Internal server error when registering user."});
    }
})

app.post('/api/auth/login', loginValidation, handleValidation, async (req: Request, res: Response) => {
    try{
        const { email, username, password } = req.body;

        const user = await User.findOne({ // find matching email or username
            $or: [
                { email: email },
                { username: username }
            ]
        });

        if(!user) {
            return res.status(404).json({error: "Invalid email/username"})
        }
        
        const checkValidPassword = await bcrypt.compare(password, user.password);
        if(!checkValidPassword) {
            return res.status(401).json({error: "Invalid password"})
        }

        const token = jwt.sign(
            {
                _id: user._id,
                username: user.username,
                isAdmin: user.isAdmin
            },
            process.env.SECRET as string,
            {expiresIn: '6h'}
        )

        res.status(200).json({ token })
    } catch (error) {
        console.log(error)
        res.status(500).json({error: "Internal Server Error when logging in."})
    }

})

app.get('/api/files/trash/list', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const trashedFiles = await File.find({ userId, isDeleted: true })
            .sort({ deletedAt: -1 });

        res.json(trashedFiles);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/files/trash/empty', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const trashedFiles = await File.find({ userId, isDeleted: true });

        const fs = await import('fs');
        for (const file of trashedFiles) {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        }

        await File.deleteMany({ userId, isDeleted: true });
        res.json({ message: 'Trash emptied', count: trashedFiles.length });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/files/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ message: 'File not found' });

        // Only owner can delete
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Soft delete - move to trash
        file.isDeleted = true;
        file.deletedAt = new Date();
        await file.save();

        res.json({ message: 'File moved to recycle bin' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/files/:id/permanent', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ message: 'File not found' });
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Delete file from disk
        const fs = await import('fs');
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        await File.findByIdAndDelete(req.params['id']);
        res.json({ message: 'File permanently deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});


// Restore file from trash
app.put('/api/files/:id/restore', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ message: 'File not found' });
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        file.isDeleted = false;
        file.deletedAt = undefined;
        await file.save();

        res.json({ message: 'File restored' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/files/:id/clone', authenticateUser, async (req: Request, res: Response) => {
    try {
        const token = req.header('authorization')?.split(' ')[1];
        const decoded = jwt.verify(token!, process.env.SECRET as string) as any;
        const userId = decoded._id;

        const original = await File.findById(req.params['id']);
        if (!original) return res.status(404).json({ message: 'File not found' });

        // Check access: owner or has edit permission
        const isOwner = original.userId.toString() === userId;
        const hasAccess = original.permissions.some(
            p => p.userId?.toString() === userId
        );
        if (!isOwner && !hasAccess) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Copy the file on disk
        const fs = await import('fs');
        const path = await import('path');

        const ext = path.extname(original.originalName);
        const baseName = path.basename(original.originalName, ext);
        const newOriginalName = `${baseName} (Copy)${ext}`;

        const newFilename = `${Date.now()}-${newOriginalName.replace(/\s+/g, '_')}`;
        const newPath = path.join(path.dirname(original.path), newFilename);

        fs.copyFileSync(original.path, newPath);

        const cloned = new File({
            userId: userId,
            filename: newFilename,
            originalName: newOriginalName,
            path: newPath,
            size: original.size,
            folder: original.folder || '/',
            createdAt: new Date(),
            uploadDate: new Date(),
            permissions: [],
            isLocked: false,
            isDeleted: false
        });

        await cloned.save();

        res.status(201).json({
            message: 'Document cloned',
            file: cloned
        });
    } catch (error) {
        console.error('Clone error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.put('/api/files/:id', authenticateUser, async (req: Request, res: Response) => {
    const { newName } = req.body;
    if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid new name' });
    }

    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.userId.toString() !== (req as any).user._id) return res.status(403).json({ error: 'Unauthorized' });

        file.originalName = newName.trim();
        file.uploadDate = new Date();
        await file.save();
        res.json({ 
            message: 'File renamed successfully', 
            file: {
                _id: file._id,
                filename: file.filename,
                originalName: file.originalName,
                size: file.size,
                uploadDate: file.uploadDate.toISOString() // this wasn't working before
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to rename file' });
    }
});

app.get('/api/files/:id/content', authenticateUser, async (req: Request, res: Response) => {
    const fileId = req.params.id;
    try {
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const userId = (req as any).user._id;
        const isOwner = file.userId.toString() === userId;
        const userPermission = file.permissions.find(p => p.userId?.toString() === userId);

        if (!isOwner && !userPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const fileExtension = file.originalName.split('.').pop()?.toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

        if (imageExtensions.includes(fileExtension || '')) {
            // Return image URL so the client can display the image
            const imagePath = file.path.replace(/\\/g, '/'); // normalize Windows backslashes
            return res.status(200).json({ isImage: true, filename: file.originalName, imagePath, canEdit: isOwner || userPermission?.permission === 'edit', isOwner });
        }
        
        const rawContent = fs.readFileSync(file.path, 'utf8');

        let content;
        try {
            content = JSON.parse(rawContent);
            if (!content.blocks) {
                content = { blocks: [{ type: 'paragraph', data: { text: rawContent } }] };
            }
        } catch {
            content = { blocks: [{ type: 'paragraph', data: { text: rawContent } }] };
        }

        
        res.status(200).json({ filename: file.originalName, content: content, isImage: false, canEdit: isOwner || userPermission?.permission === 'edit', isOwner});
    } catch (error) {
        console.log('PDF parsing error:', error);
        res.status(500).json({ error: 'Failed to fetch file content' });
    }
});

app.put('/api/files/:id/content', authenticateUser, async (req: Request, res: Response) => {
    const fileId = req.params.id;
    const { content } = req.body;

    if (content === undefined) {
        return res.status(400).json({ error: 'Content is required' });
    }
    
    try {
        const file = await File.findById(fileId);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const userId = (req as any).user._id;
        const isOwner = file.userId.toString() === userId;
        const userPermission = file.permissions.find(p => p.userId?.toString() === userId);

        const canEdit = isOwner || userPermission?.permission === 'edit';
        if (!canEdit) {
            return res.status(403).json({ error: 'You do not have edit permission' });
        }
        
        // Save as properly formatted JSON
        fs.writeFileSync(file.path, JSON.stringify(content, null, 2), 'utf8');
        
        file.uploadDate = new Date();
        await file.save();

        res.json({ message: 'Content saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

app.post('/api/files/:id/share/edit', authenticateUser, async (req: Request, res: Response) => {
    const { userId } = req.body;
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        
        if (file.userId.toString() !== (req as any).user._id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const existingPermission = file.permissions.find(p => 
            p.userId?.toString() === userId && p.permission === 'edit'
        );
        
        if (existingPermission) {
            return res.status(400).json({ error: 'User already has edit permission' });
        }

        file.permissions.push({
            userId: new mongoose.Types.ObjectId(userId),
            permission: 'edit',
            createdAt: new Date()
        });

        await file.save();
        res.json({ message: 'Edit permission granted', file });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to grant permission' });
    }
});

app.post('/api/files/:id/share/view-link', authenticateUser, async (req: Request, res: Response) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        
        if (file.userId.toString() !== (req as any).user._id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const shareToken = jwt.sign(
            { fileId: file._id, permission: 'view' },
            process.env.SECRET as string,
            { expiresIn: '30d' }
        );

        const existingLink = file.permissions.find(p => p.sharedLink && !p.userId);
        if (existingLink) {
            existingLink.sharedLink = shareToken;
        } else {
            file.permissions.push({
                permission: 'view',
                sharedLink: shareToken,
                createdAt: new Date()
            });
        }

        await file.save();
        const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/share/${shareToken}`;
        res.json({ message: 'View link created', shareUrl, shareToken });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create share link' });
    }
});

app.get('/api/files/:id/permissions', authenticateUser, async (req: Request, res: Response) => {
    try {
        const file = await File.findById(req.params.id).populate('permissions.userId', 'username email');
        if (!file) return res.status(404).json({ error: 'File not found' });
        
        if (file.userId.toString() !== (req as any).user._id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({ permissions: file.permissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

app.delete('/api/files/:id/permissions/:permissionId', authenticateUser, async (req: Request, res: Response) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) return res.status(404).json({ error: 'File not found' });
        
        if (file.userId.toString() !== (req as any).user._id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        file.permissions = file.permissions.filter(p => p._id?.toString() !== req.params.permissionId);
        await file.save();
        res.json({ message: 'Permission removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove permission' });
    }
});

app.get('/api/users/search', authenticateUser, async (req: Request, res: Response) => {
    const query = req.query.query as string;
    if (!query) return res.status(400).json({ error: 'Query required' });

    try {
        const user = await User.findOne({
            $or: [
                { email: query },
                { username: query }
            ]
        }).select('_id username email');

        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search user' });
    }
});

app.get('/api/files/shared/:token', async (req: Request, res: Response) => {
    const { token } = req.params;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET as string) as jwt.JwtPayload;
        
        if (!decoded || typeof decoded === 'string' || !decoded.fileId || decoded.permission !== 'view') {
            return res.status(403).json({ error: 'Invalid share link' });
        }

        const fileId = decoded.fileId as string;
        const file = await File.findById(fileId);
        
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const rawContent = fs.readFileSync(file.path, 'utf8');
        let content;
        try {
            content = JSON.parse(rawContent);
        } catch {
            content = { blocks: [{ type: 'paragraph', data: { text: rawContent } }] };
        }

        res.json({
            filename: file.originalName,
            content: content,
            canEdit: false
        });
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired share link' });
    }
});

app.get('/api/files', authenticateUser, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const page = parseInt(req.query['page'] as string) || 1;
        const limit = parseInt(req.query['limit'] as string) || 3;
        const sortKey = (req.query['sortKey'] as string) || 'uploadDate';
        const sortDir = (req.query['sortDir'] as string) || 'desc';
        const search = (req.query['search'] as string) || '';
        const folder = (req.query['folder'] as string) || '/';

        // Build search filter
        const searchFilter = search
            ? { originalName: { $regex: search, $options: 'i' } }
            : {};

        // Only filter by folder when not searching (search should look across all folders)
        const folderFilter = search ? {} : { folder };

        // Get files owned by user (NOT deleted) in the current folder
        const ownedFilter = { userId: user._id, isDeleted: { $ne: true }, ...folderFilter, ...searchFilter };
        const ownedFiles = await File.find(ownedFilter).select('filename originalName size createdAt uploadDate folder');

        // Get files shared with user (where they have edit permission) - exclude ones they own, exclude deleted
        const sharedFilter = {
            'permissions.userId': user._id,
            'permissions.permission': 'edit',
            userId: { $ne: user._id },
            isDeleted: { $ne: true },
            ...searchFilter
        };
        const sharedFiles = await File.find(sharedFilter).select('filename originalName size createdAt uploadDate folder');

        // Combine and sort
        const allFiles = [
            ...ownedFiles.map(f => ({ ...f.toObject(), role: 'owner' as const })),
            ...sharedFiles.map(f => ({ ...f.toObject(), role: 'editor' as const }))
        ];

        // Sort
        const sortMultiplier = sortDir === 'asc' ? 1 : -1;
        allFiles.sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (sortKey === 'name') {
                valA = a.originalName.toLowerCase();
                valB = b.originalName.toLowerCase();
            } else if (sortKey === 'createdAt') {
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
            } else {
                valA = new Date(a.uploadDate).getTime();
                valB = new Date(b.uploadDate).getTime();
            }

            if (valA < valB) return -1 * sortMultiplier;
            if (valA > valB) return 1 * sortMultiplier;
            return 0;
        });

        // Paginate
        const totalFiles = allFiles.length;
        const totalPages = Math.ceil(totalFiles / limit);
        const startIndex = (page - 1) * limit;
        const paginatedFiles = allFiles.slice(startIndex, startIndex + limit);

        res.status(200).json({
            files: paginatedFiles,
            pagination: {
                page,
                limit,
                totalFiles,
                totalPages
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to get any files.' });
    }
});


// Acquire lock
app.post('/api/files/:id/lock', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const isOwner = file.userId.toString() === userId;
        const userPermission = file.permissions.find(p => p.userId?.toString() === userId);
        const canEdit = isOwner || userPermission?.permission === 'edit';
        if (!canEdit) return res.status(403).json({ error: 'You do not have edit permission' });

        const LOCK_LEASE_MS = 30 * 1000;

        // Already locked by this user - just refresh the timestamp
        if (file.isLocked && file.lockedBy?.toString() === userId) {
            file.lockedAt = new Date();
            await file.save();
            return res.json({ message: 'Lock acquired' });
        }

        const lockExpired = file.isLocked && file.lockedAt && (Date.now() - file.lockedAt.getTime() > LOCK_LEASE_MS);

        // If lock is not held or expired
        if (!file.isLocked || lockExpired) {
            // Clear expired lock state
            if (lockExpired) {
                file.isLocked = false;
                file.lockedBy = undefined;
                file.lockedAt = undefined;
            }

            // If queue is empty, grant lock immediately
            if (file.waitingQueue.length === 0) {
                file.isLocked = true;
                file.lockedBy = new mongoose.Types.ObjectId(userId);
                file.lockedAt = new Date();
                await file.save();
                return res.json({ message: 'Lock acquired' });
            }

            // Queue has people - check if this user is first
            const firstInQueue = file.waitingQueue[0]!;
            if (firstInQueue.userId.toString() === userId) {
                // Grant lock, remove from queue
                file.waitingQueue.shift();
                file.isLocked = true;
                file.lockedBy = new mongoose.Types.ObjectId(userId);
                file.lockedAt = new Date();
                await file.save();
                return res.json({ message: 'Lock acquired' });
            }

            // This user is NOT first in queue - they must wait
            // Make sure they're in the queue
            const alreadyInQueue = file.waitingQueue.some(q => q.userId.toString() === userId);
            if (!alreadyInQueue) {
                file.waitingQueue.push({
                    userId: new mongoose.Types.ObjectId(userId),
                    joinedAt: new Date()
                });
            }
            await file.save();

            // Return queue info
            const updatedFile = await File.findById(req.params['id']).populate('waitingQueue.userId', 'username');
            const queueInfo = updatedFile?.waitingQueue || [];
            const queueNames = queueInfo.map(q => (q.userId as any)?.username || 'Unknown');
            const myPosition = queueInfo.findIndex(q => 
                (q.userId as any)?._id?.toString() === userId || q.userId?.toString() === userId
            );

            return res.status(423).json({
                lockedBy: 'nobody (waiting for queue)',
                remainingSeconds: 0,
                queue: queueNames,
                queuePosition: myPosition + 1,
                isFirstInQueue: myPosition === 0,
                lockFree: true
            });
        }

        // Lock is actively held by someone else
        // Add to queue if not already there
        const alreadyInQueue = file.waitingQueue.some(q => q.userId.toString() === userId);
        if (!alreadyInQueue) {
            file.waitingQueue.push({
                userId: new mongoose.Types.ObjectId(userId),
                joinedAt: new Date()
            });
            await file.save();
        }

        const lockHolder = await User.findById(file.lockedBy).select('username');
        const remainingMs = LOCK_LEASE_MS - (Date.now() - file.lockedAt!.getTime());

        const updatedFile = await File.findById(req.params['id']).populate('waitingQueue.userId', 'username');
        const queueInfo = updatedFile?.waitingQueue || [];
        const queueNames = queueInfo.map(q => (q.userId as any)?.username || 'Unknown');
        const myPosition = queueInfo.findIndex(q => 
            (q.userId as any)?._id?.toString() === userId || q.userId?.toString() === userId
        );

        return res.status(423).json({
            lockedBy: lockHolder?.username || 'another user',
            remainingSeconds: Math.ceil(Math.max(0, remainingMs) / 1000),
            queue: queueNames,
            queuePosition: myPosition + 1,
            isFirstInQueue: myPosition === 0,
            lockFree: false
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to acquire lock' });
    }
});


// Heartbeat - renew lock every ~5 seconds while user is active
app.put('/api/files/:id/lock', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.forceUnlocked) {
            file.forceUnlocked = false; // reset the flag
            await file.save();
            return res.status(403).json({ error: 'Force unlocked by owner' });
        }

        if (file.lockedBy?.toString() !== userId) {
            return res.status(403).json({ error: 'You do not hold this lock' });
        }

        file.lockedAt = new Date();
        await file.save();

        res.json({ message: 'Lock renewed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to renew lock' });
    }
});

// Release lock (DELETE)
app.delete('/api/files/:id/lock', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Only the lock holder can release via DELETE
        if (file.lockedBy?.toString() !== userId) {
            return res.status(403).json({ error: 'You do not hold this lock' });
        }

        file.isLocked = false;
        file.lockedBy = undefined;
        file.lockedAt = undefined;
        await file.save();

        res.json({ message: 'Lock released' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to release lock' });
    }
});

app.post('/api/files/:id/lock-release', async (req: Request, res: Response) => {
    try {
        // the lock will expire on its own after 30s without heartbeat
        res.json({ message: 'Lock noted - grace period started' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process lock release' });
    }
});

// Force unlock - owner only
app.post('/api/files/:id/force-unlock', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Only the file owner can force unlock
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Only the file owner can force unlock' });
        }

        file.isLocked = false;
        file.lockedBy = undefined;
        file.lockedAt = undefined;
        file.forceUnlocked = true; // signal to the current editor's heartbeat
        await file.save();

        res.json({ message: 'File force unlocked' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to force unlock' });
    }
});

app.get('/api/files/:id/lock-status', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const LOCK_LEASE_MS = 30 * 1000;

        // Sort waiting queue by joinedAt to ensure FIFO order
        file.waitingQueue.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

        // If lock is not held at all
        if (!file.isLocked || !file.lockedAt) {
            // If there's a queue, the first person should try to acquire
            if (file.waitingQueue.length > 0) {
                const firstInQueue = file.waitingQueue[0]!;
                if (firstInQueue.userId.toString() === userId) {
                    // This user is first - tell them to acquire
                    return res.json({ locked: false, youAreNext: true });
                }
                // Someone else is first, keep waiting
                const updatedFile = await File.findById(req.params['id']).populate('waitingQueue.userId', 'username');
                const queueInfo = updatedFile?.waitingQueue || [];
                queueInfo.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
                const queueNames = queueInfo.map(q => (q.userId as any)?.username || 'Unknown');
                const myPosition = queueInfo.findIndex(q =>
                    (q.userId as any)?._id?.toString() === userId || q.userId?.toString() === userId
                );
                return res.json({
                    locked: true,
                    lockedBy: 'next in queue',
                    isActive: true,
                    remainingSeconds: 0,
                    queue: queueNames,
                    queuePosition: myPosition + 1,
                    isFirstInQueue: false
                });
            }
            return res.json({ locked: false });
        }

        const elapsed = Date.now() - file.lockedAt.getTime();
        const lockExpired = elapsed > LOCK_LEASE_MS;

        if (lockExpired) {
            // Lock expired - clear it
            file.isLocked = false;
            file.lockedBy = undefined;
            file.lockedAt = undefined;
            await file.save();

            // If this user is first in queue, tell them to acquire
            if (file.waitingQueue.length > 0) {
                const firstInQueue = file.waitingQueue[0]!;
                if (firstInQueue.userId.toString() === userId) {
                    return res.json({ locked: false, youAreNext: true });
                }
            }
            return res.json({ locked: false });
        }

        // Lock is active
        const lockHolder = await User.findById(file.lockedBy).select('username');
        const isActive = elapsed < 7 * 1000;

        const updatedFile = await File.findById(req.params['id']).populate('waitingQueue.userId', 'username');
        const queueInfo = updatedFile?.waitingQueue || [];
        queueInfo.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
        const queueNames = queueInfo.map(q => (q.userId as any)?.username || 'Unknown');
        const myPosition = queueInfo.findIndex(q =>
            (q.userId as any)?._id?.toString() === userId || q.userId?.toString() === userId
        );
        const isFirstInQueue = myPosition === 0;

        return res.json({
            locked: true,
            lockedBy: lockHolder?.username || 'another user',
            isActive,
            remainingSeconds: Math.ceil((LOCK_LEASE_MS - elapsed) / 1000),
            queue: queueNames,
            queuePosition: myPosition + 1,
            isFirstInQueue
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get lock status' });
    }
});

app.delete('/api/files/:id/queue', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        file.waitingQueue = file.waitingQueue.filter(q => q.userId.toString() !== userId);
        await file.save();

        res.json({ message: 'Removed from queue' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to leave queue' });
    }
});

// Get all comments for a file
app.get('/api/files/:id/comments', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Check access: owner or has permission
        const isOwner = file.userId.toString() === userId;
        const userPermission = file.permissions.find(p => p.userId?.toString() === userId);
        if (!isOwner && !userPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const fileId = String(req.params['id']);
        const comments = await Comment.find({ fileId: new mongoose.Types.ObjectId(fileId) })
            .populate('userId', 'username')
            .sort({ createdAt: -1 });

        res.json({ comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Add a comment
app.post('/api/files/:id/comments', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const { blockIndex, selectedText, text } = req.body;

        if (blockIndex === undefined || !selectedText || !text) {
            return res.status(400).json({ error: 'blockIndex, selectedText, and text are required' });
        }

        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Check access: owner or has permission
        const isOwner = file.userId.toString() === userId;
        const userPermission = file.permissions.find(p => p.userId?.toString() === userId);
        if (!isOwner && !userPermission) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const comment = new Comment({
            fileId: file._id,
            userId: new mongoose.Types.ObjectId(userId),
            blockIndex,
            selectedText,
            text,
        });

        await comment.save();

        const populated = await Comment.findById(comment._id).populate('userId', 'username');
        res.status(201).json({ comment: populated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// Resolve / unresolve a comment
app.put('/api/files/:id/comments/:commentId/resolve', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const isOwner = file.userId.toString() === userId;

        const comment = await Comment.findById(req.params['commentId']);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // Only file owner or comment author can resolve
        if (!isOwner && comment.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Only the file owner or comment author can resolve' });
        }

        comment.resolved = !comment.resolved;
        comment.updatedAt = new Date();
        await comment.save();

        const populated = await Comment.findById(comment._id).populate('userId', 'username');
        res.json({ comment: populated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to resolve comment' });
    }
});

// Delete a comment
app.delete('/api/files/:id/comments/:commentId', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const userId = req.user?._id;
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const isOwner = file.userId.toString() === userId;

        const comment = await Comment.findById(req.params['commentId']);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // Only file owner or comment author can delete
        if (!isOwner && comment.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Only the file owner or comment author can delete' });
        }

        await Comment.findByIdAndDelete(req.params['commentId']);
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// Get comments for shared view-only link
app.get('/api/files/shared/:token/comments', async (req: Request, res: Response) => {
    try {
        const shareToken = String(req.params['token']);
        const decoded = jwt.verify(shareToken, process.env.SECRET as string) as jwt.JwtPayload;
        if (!decoded || typeof decoded === 'string' || !decoded.fileId || decoded.permission !== 'view') {
            return res.status(403).json({ error: 'Invalid share link' });
        }

        const comments = await Comment.find({ fileId: decoded.fileId })
            .populate('userId', 'username')
            .sort({ createdAt: -1 });

        res.json({ comments });
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired share link' });
    }
});

// ==================== CREATE BLANK DOCUMENT ====================
app.post('/api/files/create-blank', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { name, folder } = req.body;
        const docName = (name && name.trim()) ? name.trim() : 'Untitled Document';
        const targetFolder = folder || '/';

        // Create EditorJS blank content
        const editorData = {
            time: Date.now(),
            blocks: [{ type: 'paragraph', data: { text: '' } }],
            version: '2.28.0'
        };

        const uploadPath = path.join('uploads', userId.toString());
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.txt`;
        const filePath = path.join(uploadPath, filename);
        fs.writeFileSync(filePath, JSON.stringify(editorData), 'utf8');

        const originalName = docName.endsWith('.txt') ? docName : `${docName}.txt`;

        const newFile = new File({
            userId,
            filename,
            originalName,
            path: filePath,
            size: fs.statSync(filePath).size,
            folder: targetFolder,
            uploadDate: new Date(),
        });

        await newFile.save();
        res.status(201).json({ message: 'Blank document created', file: newFile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create blank document' });
    }
});

// ==================== IMAGE UPLOAD ====================
app.post('/api/files/upload-image', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        if (!file.mimetype.startsWith('image/')) {
            // Remove the uploaded file if not an image
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Only image files are allowed' });
        }

        const userId = (req as any).user._id;
        const targetFolder = (req.body.folder as string) || '/';

        const newFile = new File({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            userId,
            folder: targetFolder,
            uploadDate: new Date(),
        });

        await newFile.save();
        res.status(200).json({ message: 'Image uploaded successfully', file: newFile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// ==================== FOLDER MANAGEMENT ====================

// Create a new folder
app.post('/api/folders', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { name, parentPath } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const sanitizedName = name.trim().replace(/[\/]/g, '');
        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid folder name' });
        }

        const parent = parentPath || '/';
        const fullPath = parent === '/' ? `/${sanitizedName}` : `${parent}/${sanitizedName}`;

        // Check if folder already exists
        const existing = await Folder.findOne({ userId, path: fullPath });
        if (existing) {
            return res.status(409).json({ error: 'A folder with this name already exists here' });
        }

        const folder = new Folder({
            userId,
            name: sanitizedName,
            path: fullPath,
            parentPath: parent,
        });

        await folder.save();
        res.status(201).json({ message: 'Folder created', folder });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// List folders for current path
app.get('/api/folders', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const parentPath = (req.query['parentPath'] as string) || '/';

        const folders = await Folder.find({ userId, parentPath }).sort({ name: 1 });
        res.json({ folders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch folders' });
    }
});

// Delete a folder (and move files inside back to parent)
app.delete('/api/folders/:id', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const folder = await Folder.findById(req.params['id']);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.userId.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        // Move files in this folder to its parent
        await File.updateMany(
            { userId, folder: folder.path, isDeleted: { $ne: true } },
            { $set: { folder: folder.parentPath } }
        );

        // Delete subfolders recursively
        await Folder.deleteMany({ userId, path: { $regex: `^${folder.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)` } });

        // Delete the folder itself
        await Folder.findByIdAndDelete(req.params['id']);

        res.json({ message: 'Folder deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete folder' });
    }
});

// Move a file to a different folder
app.put('/api/files/:id/move', authenticateUser, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user._id;
        const { targetFolder } = req.body;

        if (targetFolder === undefined) {
            return res.status(400).json({ error: 'Target folder is required' });
        }

        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.userId.toString() !== userId) return res.status(403).json({ error: 'Unauthorized' });

        // Verify target folder exists (if not root)
        if (targetFolder !== '/') {
            const folderExists = await Folder.findOne({ userId, path: targetFolder });
            if (!folderExists) {
                return res.status(404).json({ error: 'Target folder does not exist' });
            }
        }

        file.folder = targetFolder;
        file.uploadDate = new Date();
        await file.save();

        res.json({ message: 'File moved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to move file' });
    }
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});