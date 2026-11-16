// backend/src/routes/audit.routes.js
const express = require('express');
const { getRecentAudit } = require('../controllers/audit.controller');
const { verifyFirebaseToken } = require('../services/firebaseAuth.service');

const router = express.Router();

// GET /api/audit/recent -> últimas operaciones registradas del usuario que pregunta
router.get('/recent', verifyFirebaseToken, getRecentAudit);

module.exports = router;
