import mongoose, { Document } from "mongoose";
interface IFolder extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    path: string;
    parentPath: string;
    createdAt: Date;
}
declare const FolderModel: mongoose.Model<IFolder, {}, {}, {}, mongoose.Document<unknown, {}, IFolder, {}, mongoose.DefaultSchemaOptions> & IFolder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IFolder>;
export { FolderModel as Folder };
export type { IFolder };
//# sourceMappingURL=Folder.d.ts.map