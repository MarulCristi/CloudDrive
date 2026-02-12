import type { Request, Response, NextFunction } from "express";
import { type JwtPayload } from "jsonwebtoken";
interface CustomRequest extends Request {
    user?: JwtPayload & {
        _id?: string;
        username?: string;
        isAdmin?: boolean;
    };
}
export declare const authenticateUser: (req: CustomRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const authenticateAdmin: (req: CustomRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export {};
//# sourceMappingURL=validateToken.d.ts.map