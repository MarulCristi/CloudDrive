import mongoose, { Document } from "mongoose";
interface IUser extends Document {
    email: string;
    password: string;
    username: string;
    isAdmin?: boolean;
}
declare const User: mongoose.Model<IUser>;
export { User };
export type { IUser };
//# sourceMappingURL=User.d.ts.map