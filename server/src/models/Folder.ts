import mongoose, { Document, Schema } from "mongoose";

interface IFolder extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    path: string;       // full path e.g. "/Documents/Work"
    parentPath: string;  // parent path e.g. "/Documents"
    createdAt: Date;
}

const FolderSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    path: { type: String, required: true },
    parentPath: { type: String, required: true, default: '/' },
    createdAt: { type: Date, default: Date.now },
});

// Compound index: unique folder path per user
FolderSchema.index({ userId: 1, path: 1 }, { unique: true });

const FolderModel = mongoose.model<IFolder>('Folder', FolderSchema);

export { FolderModel as Folder };
export type { IFolder };
