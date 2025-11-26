import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===== IN-MEMORY STORAGE =====
const users = new Map();
const credentials = new Map();
const sessions = new Map();
const candidates = new Map();
const surveys = new Map();
const votes = new Map(); // Formato: surveyId -> { candidateId: count, voters: Set(walletAddresses) }

// Limpiar sesiones expiradas cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.createdAt > 600000) {
      sessions.delete(key);
    }
  }
}, 600000);

// ===== PASSKEY/WEBAUTHN ENDPOINTS =====

// Generar challenge para registro
app.post('/api/passkey/register/options', (req, res) => {
  try {
    const { username, displayName } = req.body;

    if (!username || !displayName) {
      return res.status(400).json({ error: 'username y displayName son requeridos' });
    }

    // Generar challenge aleatorio
    const challenge = crypto.randomBytes(32);
    const sessionId = `reg-${Date.now()}-${Math.random()}`;
    const userId = `user-${Date.now()}`;

    // Guardar sesión temporal
    sessions.set(sessionId, {
      sessionId,
      userId,
      username,
      displayName,
      challenge: Buffer.from(challenge),
      createdAt: Date.now(),
      type: 'register'
    });

    res.json({
      challenge: Array.from(new Uint8Array(challenge)),
      sessionId,
      userId,
      username,
      displayName
    });
  } catch (error) {
    console.error('Error in register/options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar y guardar credencial registrada
app.post('/api/passkey/register/verify', (req, res) => {
  try {
    const { sessionId, credentialId, publicKey, username, displayName } = req.body;

    // Verificar sesión
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Sesión inválida o expirada' });
    }

    // Guardar credencial
    const credKey = `${username}-${credentialId.substring(0, 20)}`;
    credentials.set(credKey, {
      userId: session.userId,
      credentialId,
      publicKey,
      username,
      displayName,
      created_at: new Date().toISOString()
    });

    // Crear o actualizar usuario
    users.set(username, {
      _id: session.userId,
      username,
      displayName,
      wallet_address: session.userId,
      created_at: new Date().toISOString()
    });

    // Limpiar sesión
    sessions.delete(sessionId);

    res.json({
      success: true,
      userId: session.userId,
      username,
      displayName,
      message: 'Passkey registrado exitosamente'
    });
  } catch (error) {
    console.error('Error in register/verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generar challenge para autenticación
app.post('/api/passkey/authenticate/options', (req, res) => {
  try {
    const challenge = crypto.randomBytes(32);
    const sessionId = `auth-${Date.now()}-${Math.random()}`;

    sessions.set(sessionId, {
      sessionId,
      userId: `auth-${Date.now()}`,
      challenge: Buffer.from(challenge),
      createdAt: Date.now(),
      type: 'authenticate'
    });

    res.json({
      challenge: Array.from(new Uint8Array(challenge)),
      sessionId
    });
  } catch (error) {
    console.error('Error in authenticate/options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verificar autenticación
app.post('/api/passkey/authenticate/verify', (req, res) => {
  try {
    const { sessionId, credentialId, username } = req.body;

    // Verificar sesión
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: 'Sesión inválida o expirada' });
    }

    // Buscar credencial
    const credKey = Array.from(credentials.keys()).find(key =>
      key.startsWith(username) && credentials.get(key).credentialId === credentialId
    );

    if (!credKey) {
      return res.status(401).json({ error: 'Credencial no encontrada' });
    }

    // Buscar usuario
    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Limpiar sesión
    sessions.delete(sessionId);

    // Crear token de sesión
    const authToken = crypto.randomBytes(32).toString('hex');

    res.json({
      success: true,
      authToken,
      userId: user._id,
      username: user.username,
      displayName: user.displayName,
      message: '¡Autenticación exitosa!'
    });
  } catch (error) {
    console.error('Error in authenticate/verify:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== USUARIOS ENDPOINTS =====
app.post('/api/users', (req, res) => {
  try {
    const userId = `user-${Date.now()}`;
    const user = { _id: userId, ...req.body, created_at: new Date().toISOString() };
    users.set(userId, user);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const userList = Array.from(users.values());
    res.json(userList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', (req, res) => {
  try {
    const user = users.get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', (req, res) => {
  try {
    const user = users.get(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const updated = { ...user, ...req.body, _id: req.params.id };
    users.set(req.params.id, updated);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', (req, res) => {
  try {
    const deleted = users.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== CANDIDATOS ENDPOINTS =====
app.post('/api/candidates', (req, res) => {
  try {
    const candidateId = `candidate-${Date.now()}`;
    const candidate = { _id: candidateId, ...req.body, created_at: new Date().toISOString() };
    candidates.set(candidateId, candidate);
    res.status(201).json(candidate);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/candidates', (req, res) => {
  try {
    const candidateList = Array.from(candidates.values());
    res.json(candidateList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/candidates/:id', (req, res) => {
  try {
    const candidate = candidates.get(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/candidates/:id', (req, res) => {
  try {
    const candidate = candidates.get(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    const updated = { ...candidate, ...req.body, _id: req.params.id };
    candidates.set(req.params.id, updated);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/candidates/:id', (req, res) => {
  try {
    const deleted = candidates.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== SURVEYS ENDPOINTS =====
app.post('/api/surveys', (req, res) => {
  try {
    const surveyId = `survey-${Date.now()}`;
    const survey = { _id: surveyId, ...req.body, created_at: new Date().toISOString() };
    surveys.set(surveyId, survey);
    res.status(201).json(survey);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/surveys', (req, res) => {
  try {
    const surveyList = Array.from(surveys.values());
    res.json(surveyList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/surveys/:id', (req, res) => {
  try {
    const survey = surveys.get(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    res.json(survey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/surveys/:id/vote', (req, res) => {
  try {
    const { candidateId, voterAddress } = req.body;
    const surveyId = req.params.id;

    // Verificar que existe la encuesta
    const survey = surveys.get(surveyId);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    // Verificar que el candidato está en la encuesta
    if (!survey.candidates.includes(candidateId)) {
      return res.status(400).json({ error: 'Candidate not in this survey' });
    }

    // Inicializar votos para esta encuesta si no existen
    if (!votes.has(surveyId)) {
      votes.set(surveyId, {
        votes: {},
        voters: new Set()
      });
    }

    const surveyVotes = votes.get(surveyId);

    // Verificar si el usuario ya votó
    if (surveyVotes.voters.has(voterAddress)) {
      return res.status(400).json({ error: 'You have already voted in this survey' });
    }

    // Registrar el voto
    surveyVotes.voters.add(voterAddress);
    surveyVotes.votes[candidateId] = (surveyVotes.votes[candidateId] || 0) + 1;

    res.json({
      success: true,
      message: 'Vote registered successfully',
      totalVotes: surveyVotes.voters.size
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/surveys/:id/results', (req, res) => {
  try {
    const surveyId = req.params.id;
    const survey = surveys.get(surveyId);

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    const surveyVotes = votes.get(surveyId) || { votes: {}, voters: new Set() };
    const totalVotes = surveyVotes.voters.size;

    // Crear resultados con información de candidatos
    const results = survey.candidates.map(candidateId => {
      const candidate = candidates.get(candidateId);
      const voteCount = surveyVotes.votes[candidateId] || 0;
      const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100).toFixed(2) : 0;

      return {
        candidateId,
        candidateName: candidate ? candidate.name : 'Unknown',
        votes: voteCount,
        percentage: parseFloat(percentage)
      };
    });

    res.json({
      surveyId,
      surveyName: survey.name,
      totalVotes,
      results: results.sort((a, b) => b.votes - a.votes)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/surveys/:id/check-vote', (req, res) => {
  try {
    const { voterAddress } = req.body;
    const surveyId = req.params.id;

    const surveyVotes = votes.get(surveyId);
    const hasVoted = surveyVotes ? surveyVotes.voters.has(voterAddress) : false;

    res.json({ hasVoted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/surveys/:id', (req, res) => {
  try {
    const survey = surveys.get(req.params.id);
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    const updated = { ...survey, ...req.body };
    surveys.set(req.params.id, updated);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/surveys/:id', (req, res) => {
  try {
    surveys.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== DEBUG ENDPOINT =====
app.get('/api/debug', (req, res) => {
  res.json({
    users: Array.from(users.entries()).map(([key, user]) => ({ key, user })),
    credentials: Array.from(credentials.entries()).map(([key, cred]) => ({
      key,
      credentialId: cred.credentialId.substring(0, 20) + '...',
      username: cred.username
    })),
    sessions: Array.from(sessions.entries()).map(([key, session]) => ({
      key,
      type: session.type,
      username: session.username
    }))
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Passkey API: http://localhost:${PORT}/api/passkey/`);
  console.log(`🔍 Debug: http://localhost:${PORT}/api/debug`);
});