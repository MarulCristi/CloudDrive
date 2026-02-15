import mongoose, {Document, Schema} from "mongoose";

interface IFile extends Document {
    userId: mongoose.Types.ObjectId, // get inside of the DB to get the user's id of the one that created the file.
    filename: string,
    originalName: string,
    path: string,
    size: number, // In bytes
    uploadDate: Date
}

const FileSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // where it's saved on the server
    size: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now }
});

const FileModel = mongoose.model<IFile>('File', FileSchema);

export { FileModel as File };
export type { IFile };