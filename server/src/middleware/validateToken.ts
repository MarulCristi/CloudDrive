import type {Request, Response, NextFunction} from "express"
import jwt, {type JwtPayload} from "jsonwebtoken"

interface CustomRequest extends Request {
    user?: JwtPayload & { _id?: string; username?: string; isAdmin?: boolean };
}

export const authenticateUser = (req: CustomRequest, res: Response, next: NextFunction) => {
    const token: string | undefined = req.header('authorization')?.split(" ")[1]

    if(!token) return res.status(401).json({message: "Access denied, no token"})

    try {
        const decoded = jwt.verify(token, process.env.SECRET as string) as JwtPayload & {
        _id?: string;
        username?: string;
        isAdmin?: boolean;
        };
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
}

export const authenticateAdmin = (req: CustomRequest, res: Response, next: NextFunction) => {
    const token: string | undefined = req.header('authorization')?.split(" ")[1]

    if(!token) return res.status(401).json({message: "Access denied, no token"})

    try {
        const decoded = jwt.verify(token, process.env.SECRET as string) as JwtPayload & {
            _id?: string;
            username?: string;
            isAdmin?: boolean;
        };
        if (!decoded.isAdmin) return res.status(403).json({ message: "Access denied." });
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token." });
    }
}

