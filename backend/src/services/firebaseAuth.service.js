// backend/src/services/firebaseAuth.service.js
// Middleware verifyFirebaseToken (Módulo 7, paso 2 de la guía).
const config = require('../config/env');
const { getFirebaseAuth } = require('../config/firebase');

if (config.authDisabled) {
  console.warn('⚠  AUTH_DISABLED=true: el login está desactivado (solo desarrollo local).');
}

async function verifyFirebaseToken(req, res, next) {
  if (config.authDisabled) {
    req.user = { uid: 'dev-local', email: 'dev@localhost', name: 'Desarrollo local' };
    return next();
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ success: false, error: 'Falta el token de autenticación' });
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(match[1]);
    req.user = { uid: decoded.uid, email: decoded.email || null, name: decoded.name || null };
    return next();
  } catch (err) {
    const expired = err.code === 'auth/id-token-expired';
    return res.status(401).json({
      success: false,
      error: expired ? 'La sesión expiró, vuelve a iniciar sesión' : 'Token inválido',
    });
  }
}

module.exports = { verifyFirebaseToken };
