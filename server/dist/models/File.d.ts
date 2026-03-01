import mongoose, { Document } from "mongoose";
interface IFile extends Document {
    userId: mongoose.Types.ObjectId;
    filename: string;
    originalName: string;
    path: string;
    size: number;
    createdAt: Date;
    uploadDate: Date;
    permissions: Array<{
        _id?: mongoose.Types.ObjectId;
        userId?: mongoose.Types.ObjectId;
        permission: 'edit' | 'view';
        sharedLink?: string;
        createdAt: Date;
    }>;
    isLocked: boolean;
    lockedBy?: mongoose.Types.ObjectId | undefined;
    lockedAt?: Date | undefined;
    forceUnlocked?: Boolean | undefined;
    isDeleted: boolean;
    deletedAt?: Date | undefined;
    waitingQueue: Array<{
        userId: mongoose.Types.ObjectId;
        joinedAt: Date;
    }>;
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