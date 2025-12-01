import mongoose from 'mongoose';

const CandidateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    party: { type: String },
    description: { type: String },
    imageUrl: { type: String },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Candidate', CandidateSchema);
