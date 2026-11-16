// backend/src/routes/chat.routes.js
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { postChat, postChatStream, getSystemPrompt } = require('../controllers/chat.controller');
const { verifyFirebaseToken } = require('../services/firebaseAuth.service');

const router = express.Router();

// Cada pregunta cuesta tokens de Claude: límite por usuario
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE || 15),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip),
  message: { success: false, error: 'Demasiadas preguntas seguidas. Espera un minuto.' },
});

// POST /api/chat          -> respuesta completa (JSON)
router.post('/', verifyFirebaseToken, chatLimiter, postChat);
// POST /api/chat/stream   -> respuesta en streaming (Server-Sent Events)
router.post('/stream', verifyFirebaseToken, chatLimiter, postChatStream);
// GET /api/chat/system-prompt -> prompt de sistema (para verlo en la web; no se edita desde aquí)
router.get('/system-prompt', verifyFirebaseToken, getSystemPrompt);

module.exports = router;
