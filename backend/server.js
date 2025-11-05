import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cenvote')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const userSchema = new mongoose.Schema({
  first_name: String,
  paternal_last_name: String,
  maternal_last_name: String,
  phone: String,
  email: String,
  wallet_address: String,
  created_at: { type: Date, default: Date.now }
});

const candidateSchema = new mongoose.Schema({
  name: String,
  rfc: String,
  wallet_address: String,
  created_at: { type: Date, default: Date.now }
});

const surveySchema = new mongoose.Schema({
  name: String,
  description: String,
  start_date: Date,
  end_date: Date,
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' }],
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Candidate = mongoose.model('Candidate', candidateSchema);
const Survey = mongoose.model('Survey', surveySchema);

// Routes
// Users
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Candidates
app.post('/api/candidates', async (req, res) => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    res.status(201).json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find();
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Surveys
app.post('/api/surveys', async (req, res) => {
  try {
    const survey = new Survey(req.body);
    await survey.save();
    res.status(201).json(survey);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/surveys', async (req, res) => {
  try {
    const surveys = await Survey.find().populate('candidates created_by');
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(survey);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/surveys/:id', async (req, res) => {
  try {
    await Survey.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});