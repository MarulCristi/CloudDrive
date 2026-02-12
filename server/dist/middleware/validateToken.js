import jwt, {} from "jsonwebtoken";
export const authenticateUser = (req, res, next) => {
    const token = req.header('authorization')?.split(" ")[1];
    if (!token)
        return res.status(401).json({ message: "Access denied, no token" });
    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
};
export const authenticateAdmin = (req, res, next) => {
    const token = req.header('authorization')?.split(" ")[1];
    if (!token)
        return res.status(401).json({ message: "Access denied, no token" });
    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        if (!decoded.isAdmin)
            return res.status(403).json({ message: "Access denied." });
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
};
//# sourceMappingURL=validateToken.js.map