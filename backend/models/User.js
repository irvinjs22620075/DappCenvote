import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    wallet_address: { type: String },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
