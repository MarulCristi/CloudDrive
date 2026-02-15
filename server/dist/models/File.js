import mongoose, { Document, Schema } from "mongoose";
const FileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // where it's saved on the server
    size: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now }
});
const FileModel = mongoose.model('File', FileSchema);
export { FileModel as File };
//# sourceMappingURL=File.js.map