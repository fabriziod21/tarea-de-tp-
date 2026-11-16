// backend/src/routes/rag.routes.js
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getVectorStore, postVectorSearch } = require('../controllers/rag.controller');
const { verifyFirebaseToken } = require('../services/firebaseAuth.service');

const router = express.Router();

// Cada búsqueda calcula un embedding en el servidor: límite por usuario
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip),
  message: { success: false, error: 'Demasiadas búsquedas seguidas. Espera un minuto.' },
});

// GET  /api/rag/documents -> contenido de la base vectorial
router.get('/documents', verifyFirebaseToken, getVectorStore);
// POST /api/rag/search    -> búsqueda por significado (sin llamar a Claude)
router.post('/search', verifyFirebaseToken, searchLimiter, postVectorSearch);

module.exports = router;
