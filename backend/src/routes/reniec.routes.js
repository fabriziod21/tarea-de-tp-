// backend/src/routes/reniec.routes.js  (Módulo 4.4)
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { consultarDNI, consultarRUC } = require('../services/reniec.service');
const { verifyFirebaseToken } = require('../services/firebaseAuth.service');
const audit = require('../logs/auditLogger');

const router = express.Router();

// Middleware de autenticación
router.use(verifyFirebaseToken);

// Cada consulta real gasta un crédito de Json.pe (100 al mes en el plan gratis)
router.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip),
    message: { success: false, error: 'Demasiadas consultas. Espera un minuto.' },
  })
);

function handler(tipo, fn) {
  return async (req, res) => {
    const { numero } = req.params;
    try {
      const datos = await fn(numero);
      audit.logReniec({ userId: req.user.uid, tipo, numero, ok: true });
      res.json({ success: true, data: datos });
    } catch (error) {
      audit.logReniec({ userId: req.user.uid, tipo, numero, ok: false, error: error.message });
      res.status(error.status && error.status < 600 ? error.status : 400).json({ success: false, error: error.message });
    }
  };
}

// GET /api/reniec/dni/:numero
router.get('/dni/:numero', handler('dni', consultarDNI));

// GET /api/reniec/ruc/:numero
router.get('/ruc/:numero', handler('ruc', consultarRUC));

module.exports = router;
