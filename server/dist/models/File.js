import mongoose, { Document, Schema } from "mongoose";
const FileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // where it's saved on the server
    size: { type: Number, required: true },
    folder: { type: String, default: '/' },
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
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    waitingQueue: [{
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            joinedAt: { type: Date, default: Date.now }
        }]
});
const FileModel = mongoose.model('File', FileSchema);
export { FileModel as File };
//# sourceMappingURL=File.js.map