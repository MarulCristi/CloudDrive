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
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit to avoid ruining my computer
})

app.post('/api/files/upload', authenticateUser, upload.single('file'), async (req: Request, res: Response) => {
    try {
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = (req as any).user; // From authenticateUser
        if (!user || !user._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const file = req.file;
        const fileData = {
            userId: user._id,
            filename: file.filename,
            originalName: file.originalname,
            path: file.path,
            size: file.size,
            
        }

        const newFile = new File(fileData);
        await newFile.save()

        res.status(201).json({ message: 'File uploaded successfully', file: newFile });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
})

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
            {expiresIn: '5min'}
        )

        res.status(200).json({ token })
    } catch (error) {
        console.log(error)
        res.status(500).json({error: "Internal Server Error when logging in."})
    }

})



app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});