import mongoose, { Document, Schema } from "mongoose";

interface IComment extends Document {
    fileId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    blockIndex: number;         // Which EditorJS block is commented on
    selectedText: string;       // The highlighted text the comment refers to
    text: string;               // The comment body
    resolved: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
    fileId: { type: Schema.Types.ObjectId, ref: 'File', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blockIndex: { type: Number, required: true },
    selectedText: { type: String, required: true },
    text: { type: String, required: true },
    resolved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Comment = mongoose.model<IComment>("Comment", CommentSchema);

export { Comment };
export type { IComment };
