import express, { type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, authenticateAdmin } from './middleware/validateToken.js';
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

app.get('/api/files', authenticateUser, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        
        const files = await File.find({ userId: user._id }).select('-__v') // This excludes __v from the MongoDB.
        res.status(200).json({ files })
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to get any files.'})
    }
})

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
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const fileExtension = file.originalName.split('.').pop()?.toLowerCase();
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

        if (imageExtensions.includes(fileExtension || '')) {
            return res.status(200).json({ isImage: true, filename: file.originalName });
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

        
        res.status(200).json({ filename: file.originalName, content: content, isImage: false});
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
        if (file.userId.toString() !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
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



app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});