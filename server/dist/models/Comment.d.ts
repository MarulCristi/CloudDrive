import mongoose, { Document } from "mongoose";
interface IComment extends Document {
    fileId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    blockIndex: number;
    selectedText: string;
    text: string;
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const Comment: mongoose.Model<IComment, {}, {}, {}, mongoose.Document<unknown, {}, IComment, {}, mongoose.DefaultSchemaOptions> & IComment & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IComment>;
export { Comment };
export type { IComment };
//# sourceMappingURL=Comment.d.ts.map