import mongoose, {Document, Schema} from "mongoose";

interface IFile extends Document {
    userId: mongoose.Types.ObjectId, // get inside of the DB to get the user's id of the one that created the file.
    filename: string,
    originalName: string,
    path: string,
    size: number, // In bytes
    createdAt: Date,
    uploadDate: Date,
    permissions: Array<{
        _id?: mongoose.Types.ObjectId,
        userId?: mongoose.Types.ObjectId,
        permission: 'edit' | 'view',
        sharedLink?: string,
        createdAt: Date
    }>,
    isLocked: boolean,
    lockedBy?: mongoose.Types.ObjectId | undefined,
    lockedAt?: Date | undefined,
    forceUnlocked?: Boolean | undefined
}

const FileSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // where it's saved on the server
    size: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    uploadDate: { type: Date, default: Date.now },
    permissions: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        permission: { type: String, enum: ['edit', 'view'], required: true },
        sharedLink: { type: String, unique: true, sparse: true },
        createdAt: { type: Date, default: Date.now }
    }],
    isLocked: { type: Boolean, default: false },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    forceUnlocked: { type: Boolean, default: false },
});

const FileModel = mongoose.model<IFile>('File', FileSchema);

export { FileModel as File };
export type { IFile };