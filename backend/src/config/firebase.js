// backend/src/config/firebase.js
// Inicializa Firebase Admin SDK con las credenciales de la cuenta de servicio.
const config = require('./env');

let adminApp = null;

function getFirebaseAdmin() {
  if (adminApp) return adminApp;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      'Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY en backend/.env' +
        (config.isProduction ? '' : ' (o usa AUTH_DISABLED=true para desarrollar sin login)')
    );
  }

  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  adminApp =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // En .env y en Render la clave viene con "\n" literales: hay que convertirlos
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  return adminApp;
}

function getFirebaseAuth() {
  const { getAuth } = require('firebase-admin/auth');
  return getAuth(getFirebaseAdmin());
}

module.exports = { getFirebaseAdmin, getFirebaseAuth };
