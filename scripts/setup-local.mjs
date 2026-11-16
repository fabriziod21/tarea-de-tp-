// scripts/setup-local.mjs
// Crea backend/.env y frontend/.env para DESARROLLO LOCAL en un clon nuevo del repo.
// Nunca sobrescribe un .env que ya exista.
//
//   npm run setup
//
// Deja el proyecto listo para: npm run db:dev (PostgreSQL local) + npm run dev.
// Valores: Claude Code como cerebro (sin API key), login desactivado, RENIEC simulado.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendEnv = path.join(root, 'backend/.env');
const frontendEnv = path.join(root, 'frontend/.env');

// Contraseña aleatoria para chatbot_reader (solo letras, números, - y _)
const readerPassword = `Lector_${crypto.randomBytes(12).toString('base64url')}`;
const chromaInstalled = fs.existsSync(path.join(root, '.venv-chroma'));

const BACKEND = `# backend/.env — configuración LOCAL de desarrollo (creada por npm run setup; no se sube a GitHub)
# Funciona con \`npm run db:dev\` (PostgreSQL local en el puerto 5433).
# Para Neon / producción, copia los valores de .env.example y reemplázalos.

PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# code = usa TU Claude Code (sesión de tu cuenta, sin API key). Solo funciona en tu PC.
# api  = Claude API con ANTHROPIC_API_KEY (lo que se despliega en Render)
CLAUDE_PROVIDER=code
CLAUDE_CODE_MODEL=sonnet
# Opcional: ruta al ejecutable de Claude Code si el backend no lo encuentra solo
# CLAUDE_CODE_PATH=

ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-5-5
CLAUDE_EFFORT=medium
CLAUDE_FALLBACKS=default

# Sin Firebase configurado todavía: login desactivado en local
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
AUTH_DISABLED=true

# PostgreSQL local (npm run db:dev). DB_PASSWORD es la contraseña de chatbot_reader:
# se usa al crear la base la PRIMERA vez. Si la cambias después, usa npm run db:dev -- --reset
DB_HOST=localhost
DB_PORT=5433
DB_NAME=chatbot_urp
DB_USER=chatbot_reader
DB_PASSWORD=${readerPassword}
DB_SSL=false
DB_ADMIN_URL=postgresql://postgres:postgres_dev@localhost:5433/chatbot_urp

MCP_SERVER_NAME=postgres-mcp-server

# RENIEC / SUNAT vía Json.pe (un solo token para DNI y RUC). true = datos simulados
JSONPE_API_TOKEN=
JSONPE_BASE_URL=https://api.json.pe
RENIEC_MOCK=true

# RAG: chroma (ChromaDB local, npm run chroma:setup) | local (índice JSON, sin instalar nada)
RAG_PROVIDER=${chromaInstalled ? 'chroma' : 'local'}
CHROMA_URL=http://127.0.0.1:8000
`;

const FRONTEND = `# frontend/.env — desarrollo local (creado por npm run setup; no se sube a GitHub)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=
# true = sin login (debe coincidir con AUTH_DISABLED=true del backend)
VITE_AUTH_DISABLED=true
`;

function create(file, content) {
  const rel = path.relative(root, file);
  if (fs.existsSync(file)) {
    console.log(`• ${rel} ya existe: no se toca`);
    return false;
  }
  fs.writeFileSync(file, content);
  console.log(`✔ ${rel} creado`);
  return true;
}

const createdBackend = create(backendEnv, BACKEND);
create(frontendEnv, FRONTEND);

if (createdBackend && fs.existsSync(path.join(root, '.dev-db', 'data', 'PG_VERSION'))) {
  console.log(
    '\n⚠ Ya existe una base local (.dev-db/) creada con otra contraseña de chatbot_reader.' +
      '\n  Ejecuta una vez: npm run db:dev -- --reset   (borra y vuelve a crear la base local)'
  );
}

console.log(`
Siguientes pasos:
  1. (opcional, recomendado) npm run chroma:setup   -> ChromaDB local, como pide la guía (requiere Python 3.10+)
  2. Terminal 1: npm run db:dev                      -> PostgreSQL local con tablas y datos
  3. Terminal 2: npm run dev                         -> ChromaDB + backend (:3001) + frontend (:5173)
  4. Abre http://localhost:5173`);
