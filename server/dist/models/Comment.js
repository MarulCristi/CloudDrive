import mongoose, { Document, Schema } from "mongoose";
const CommentSchema = new Schema({
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockIndex: { type: Number, required: true },
    selectedText: { type: String, required: true },
    text: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const Comment = mongoose.model("Comment", CommentSchema);
export { Comment };
//# sourceMappingURL=Comment.js.map