// frontend/src/services/firebase.js
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Sin config de Firebase (o con VITE_AUTH_DISABLED=true) la app entra en modo desarrollo
export const authDisabled =
  import.meta.env.VITE_AUTH_DISABLED === 'true' || !firebaseConfig.apiKey || !firebaseConfig.projectId;

const auth = authDisabled ? null : getAuth(initializeApp(firebaseConfig));

const DEV_USER = { uid: 'dev-local', email: 'modo desarrollo', displayName: 'Desarrollo local', dev: true };

export function watchUser(callback) {
  if (authDisabled) {
    callback(DEV_USER);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return authDisabled ? Promise.resolve() : signOut(auth);
}

/** ID Token que el backend verifica con verifyFirebaseToken */
export async function getIdToken() {
  if (authDisabled || !auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/** Mensajes de error de Firebase en español */
export function authErrorMessage(err) {
  const map = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/popup-closed-by-user': 'Se cerró la ventana de Google antes de terminar.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  };
  return map[err?.code] || 'No se pudo iniciar sesión. Intenta de nuevo.';
}
