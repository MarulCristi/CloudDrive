import mongoose, { Document, Schema } from "mongoose";
const FolderSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    path: { type: String, required: true },
    parentPath: { type: String, required: true, default: '/' },
    createdAt: { type: Date, default: Date.now },
});
// Compound index: unique folder path per user
FolderSchema.index({ userId: 1, path: 1 }, { unique: true });
const FolderModel = mongoose.model('Folder', FolderSchema);
export { FolderModel as Folder };
//# sourceMappingURL=Folder.js.map