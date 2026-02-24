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

// File filter to only allow text files
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('text/') || file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
    } else {
        cb(new Error('Only text files are allowed!'));
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

    $('body').children().each((_, element) => {
        const el = $(element);
        const tag = element.tagName.toLowerCase();

        // Helper to get HTML with formatting preserved
        const getFormattedText = () => {
            let text = el.html() || '';
            // Replace <strong> with <b> for EditorJS compatibility
            text = text.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
            return text.trim();
        };

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
            const items = el.find('li').map((_, li) => {
                const $li = $(li);
                let text = $li.html() || '';
                text = text.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
                return text.trim();
            }).get();
            if (items.length > 0) {
                blocks.push({ type: 'list', data: { style: 'unordered', items } });
            }
        } else if (tag === 'ol') {
            const items = el.find('li').map((_, li) => {
                const $li = $(li);
                let text = $li.html() || '';
                text = text.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>');
                return text.trim();
            }).get();
            if (items.length > 0) {
                blocks.push({ type: 'list', data: { style: 'ordered', items } });
            }
        } else if (tag === 'table') {
            const rows: string[][] = [];
            let withHeadings = false;

            // Check if table has thead
            const thead = el.find('thead');
            if (thead.length > 0) {
                withHeadings = true;
                thead.find('tr').each((_, tr) => {
                    const row = $(tr).find('th, td').map((_, cell) => $(cell).text().trim()).get();
                    if (row.length > 0) rows.push(row);
                });
            }

            // Process table body
            el.find('tbody tr, tr').each((_, tr) => {
                // Skip if already processed in thead
                if ($(tr).closest('thead').length > 0) return;
                
                const row = $(tr).find('td, th').map((_, cell) => $(cell).text().trim()).get();
                if (row.length > 0) rows.push(row);
            });

            if (rows.length > 0) {
                blocks.push({
                    type: 'table',
                    data: {
                        withHeadings,
                        content: rows
                    }
                });
            }
        } else if (tag === 'blockquote') {
            const text = getFormattedText();
            if (text) {
                blocks.push({
                    type: 'quote',
                    data: {
                        text,
                        caption: '',
                        alignment: 'left'
                    }
                });
            }
        } else if (tag === 'pre' || tag === 'code') {
            const code = el.text().trim();
            if (code) {
                blocks.push({
                    type: 'code',
                    data: {
                        code
                    }
                });
            }
        } else if (tag === 'hr') {
            blocks.push({
                type: 'delimiter',
                data: {}
            });
        } else if (tag === 'img') {
            const src = el.attr('src');
            const alt = el.attr('alt') || '';
            if (src) {
                blocks.push({
                    type: 'image',
                    data: {
                        file: { url: src },
                        caption: alt,
                        withBorder: false,
                        stretched: false,
                        withBackground: false
                    }
                });
            }
        } else if (tag === 'p') {
            const text = getFormattedText();
            if (text) {
                blocks.push({ type: 'paragraph', data: { text } });
            }
        } else if (tag === 'div') {
            // Handle divs as paragraphs if they contain text
            const text = getFormattedText();
            if (text) {
                blocks.push({ type: 'paragraph', data: { text } });
            }
        }
    });

    return blocks.length > 0 ? blocks : [{ type: 'paragraph', data: { text: '' } }];
}

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
                uploadDate: new Date(),
            });

            await newFile.save();
            return res.status(200).json({ message: 'File uploaded and converted successfully', file: newFile });
        }

        // For all other files (.txt, .html, etc.) save normally
        const newFile = new File({
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            userId,
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

app.delete('/api/files/:id', authenticateUser, async (req: Request, res: Response) => {
    const fileId = req.params.id;
    try {
        const file = await File.findById(fileId);
        if(!file) {
            return res.status(404).json({ error: 'File not found in DB.'});
        }
        const userId = (req as any).user._id;
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await File.findByIdAndDelete(fileId);
        res.json({ message: 'File deleted successfully' });

        // remove uploads from server uploads folder.
        fs.unlink(file.path, (err) => { 
            if (err) console.error('Error deleting file from fs:', err);
        });

        // remove folder if empty.
        const userFolder = path.dirname(file.path);
        fs.readdir(userFolder, (err, files) => {
            if (!err && files.length === 0) {
                fs.rmdir(userFolder, (rmErr) => {
                    if (rmErr) console.error('Error removing empty folder:', rmErr);
                });
            }
        });


    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to delete file' })
    }
})

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
            return res.status(200).json({ isImage: true, filename: file.originalName, canEdit: isOwner || userPermission?.permission === 'edit'});
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

        
        res.status(200).json({ filename: file.originalName, content: content, isImage: false, canEdit: isOwner || userPermission?.permission === 'edit'});
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
        
        // Get files owned by user
        const ownedFiles = await File.find({ userId: user._id }).select('filename originalName size uploadDate');
        
        // Get files shared with user (where they have edit permission) - exclude ones they own
        const sharedFiles = await File.find({
            'permissions.userId': user._id,
            'permissions.permission': 'edit',
            userId: { $ne: user._id }  // Exclude files owned by this user
        }).select('filename originalName size uploadDate');

        const allFiles = [
            ...ownedFiles.map(f => ({ ...f.toObject(), role: 'owner' as const })),
            ...sharedFiles.map(f => ({ ...f.toObject(), role: 'editor' as const }))
        ];

        res.status(200).json({ files: allFiles });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to get any files.'})
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

        const LOCK_LEASE_MS = 30 * 1000; // 30 second grace period
        const lockExpired = file.lockedAt && (Date.now() - file.lockedAt.getTime() > LOCK_LEASE_MS);

        // Locked by someone else and lease hasn't expired
        if (file.isLocked && file.lockedBy?.toString() !== userId && !lockExpired) {
            const lockHolder = await User.findById(file.lockedBy).select('username');
            const remainingMs = LOCK_LEASE_MS - (Date.now() - file.lockedAt!.getTime());
            return res.status(423).json({
                lockedBy: lockHolder?.username || 'another user',
                remainingSeconds: Math.ceil(remainingMs / 1000)
            });
        }

        // Grant or renew lock
        file.isLocked = true;
        file.lockedBy = new mongoose.Types.ObjectId(userId);
        file.lockedAt = new Date();
        await file.save();

        res.json({ message: 'Lock acquired' });
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

        if (file.lockedBy?.toString() !== userId) {
            return res.status(403).json({ error: 'You do not hold this lock' });
        }

        // Renew the lease timestamp
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
        }

        file.isLocked = false;
        file.lockedBy = undefined;
        file.lockedAt = undefined;
        await file.save();

        res.json({ message: 'File force unlocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to force unlock' });
    }
});

app.get('/api/files/:id/lock-status', authenticateUser, async (req: CustomRequest, res: Response) => {
    try {
        const file = await File.findById(req.params['id']);
        if (!file) return res.status(404).json({ error: 'File not found' });

        const LOCK_LEASE_MS = 30 * 1000;

        if (!file.isLocked || !file.lockedAt) {
            return res.json({ locked: false });
        }

        const elapsed = Date.now() - file.lockedAt.getTime();
        const lockExpired = elapsed > LOCK_LEASE_MS;

        if (lockExpired) {
            return res.json({ locked: false });
        }

        const lockHolder = await User.findById(file.lockedBy).select('username');

        // Check if the lock is being actively renewed (heartbeat running)
        // If lockedAt was updated recently (within 20s), user is still active
        const isActive = elapsed < 20 * 1000;

        return res.json({
            locked: true,
            lockedBy: lockHolder?.username || 'another user',
            isActive,                                       // true = user is present, false = user left
            remainingSeconds: Math.ceil((LOCK_LEASE_MS - elapsed) / 1000), // only meaningful when !isActive
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get lock status' });
    }
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});