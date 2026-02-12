import mongoose, { Document, Schema } from "mongoose";
const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: false },
    isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model("User", UserSchema);
export { User };
//# sourceMappingURL=User.js.map