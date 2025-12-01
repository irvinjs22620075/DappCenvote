import mongoose from 'mongoose';

const SurveySchema = new mongoose.Schema({
    _id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    candidates: [{ type: String, ref: 'Candidate' }],
    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now }
});

export default mongoose.model('Survey', SurveySchema);
