import mongoose, { Document } from "mongoose";
interface IFile extends Document {
    userId: mongoose.Types.ObjectId;
    filename: string;
    originalName: string;
    path: string;
    size: number;
    uploadDate: Date;
}
declare const FileModel: mongoose.Model<IFile, {}, {}, {}, mongoose.Document<unknown, {}, IFile, {}, mongoose.DefaultSchemaOptions> & IFile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IFile>;
export { FileModel as File };
export type { IFile };
//# sourceMappingURL=File.d.ts.map