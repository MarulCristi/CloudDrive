import express, {} from 'express';
import mongoose from 'mongoose';
import { authenticateUser, authenticateAdmin } from './middleware/validateToken.js';
import { User } from './models/User.js';
import { registerValidation, loginValidation, handleValidation } from './validators/inputValidation.js';
import bcrypt from "bcryptjs";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
const app = express();
const port = 3000;
app.use(express.json());
console.log("Server is running");
const mongoDB = "mongodb://127.0.0.1:27017/testdb";
mongoose.connect(mongoDB);
mongoose.Promise = Promise;
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error"));
app.post('/api/auth/register', registerValidation, handleValidation, async (req, res) => {
    try {
        const { email, password, username, isAdmin } = req.body;
        const emailUsed = await User.findOne({ email });
        if (emailUsed) {
            return res.status(403).json({ error: "Email is already in use" });
        }
        const usernameUsed = await User.findOne({ username });
        if (usernameUsed) {
            return res.status(403).json({ error: "Username is already in use" }); // besides email, username also needs to be unique.
        }
        const hashedPassword = await bcrypt.hash(password, 10); // using bcrypt to turn password123 into auhw3hyuwSHDAHUKE#!@#!U*832. 10 for more protection
        const newUser = new User({ email, password: hashedPassword, username, isAdmin: Boolean(isAdmin) });
        await newUser.save();
        res.status(201).json({ message: "User added successfully!" });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error when registering user." });
    }
});
app.post('/api/auth/login', loginValidation, handleValidation, async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const checkValidPassword = await bcrypt.compare(password, user.password);
        if (!checkValidPassword) {
            return res.status(401).json({ error: "Invalid password" });
        }
        const token = jwt.sign({
            _id: user._id,
            username: user.username,
            isAdmin: user.isAdmin
        }, process.env.SECRET, { expiresIn: '15min' });
        res.status(200).json({ token });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error: "Internal Server Error when logging in." });
    }
});
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
//# sourceMappingURL=index.js.map