// backend/src/app.js
// Aplicación Express (separada de index.js para poder probarla sin abrir un puerto).
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const { pool } = require('./config/database');
const chatRoutes = require('./routes/chat.routes');
const reniecRoutes = require('./routes/reniec.routes');
const ragRoutes = require('./routes/rag.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

// Render pone un proxy delante: necesario para que el rate limit vea la IP real
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  cors({
    origin: (origin, cb) => {
      // Sin origin = curl / Postman / mismo servidor
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '100kb' }));

// Estado del servicio (útil para Render y para la demo)
app.get('/api/health', async (req, res) => {
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    db = `error: ${err.message}`;
  }
  res.json({
    status: 'ok',
    db,
    claude: config.claude.provider === 'code' ? 'claude-code (local)' : `api (${config.claude.model})`,
    claudeKey: config.claude.provider === 'api' ? Boolean(process.env.ANTHROPIC_API_KEY) : 'no necesaria',
    auth: config.authDisabled ? 'desactivado (desarrollo)' : 'firebase',
    rag: process.env.RAG_PROVIDER || 'local',
    reniec: process.env.RENIEC_MOCK === 'true' ? 'simulado' : 'json.pe',
  });
});

app.use('/api/chat', chatRoutes);
app.use('/api/reniec', reniecRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/audit', auditRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Manejador de errores (Express 5 también captura errores de funciones async)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'JSON inválido' });
  }
  if (err.message?.startsWith('Origen no permitido')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  console.error('[error]', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

module.exports = app;
