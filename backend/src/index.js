// backend/src/index.js — Punto de entrada Express
const config = require('./config/env');
const app = require('./app');
const { getMcpClient, closeMcpClient } = require('./services/mcpClient.service');
const { warmUp } = require('./services/ragRetriever.service');
const { closePool } = require('./config/database');
const { resolveClaudeBinary } = require('./services/claudeCode.service');

const server = app.listen(config.port, config.host, () => {
  console.log(`API escuchando en http://${config.host}:${config.port}`);
  const brain =
    config.claude.provider === 'code' ? `Claude Code (${process.env.CLAUDE_CODE_MODEL || 'sonnet'})` : `API · ${config.claude.model}`;
  console.log(`  Claude: ${brain} · RAG: ${process.env.RAG_PROVIDER || 'local'} · Auth: ${config.authDisabled ? 'DESACTIVADA (dev)' : 'Firebase'}`);

  if (config.claude.provider === 'code') {
    const binary = resolveClaudeBinary();
    if (binary) console.log(`  Claude Code: ${binary}`);
    else console.warn('⚠  No se encontró Claude Code. Define CLAUDE_CODE_PATH en backend/.env.');
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠  Falta ANTHROPIC_API_KEY en backend/.env: /api/chat responderá con error hasta que la agregues (o usa CLAUDE_PROVIDER=code).');
  }

  // Precalentar: conectar el MCP Server y cargar el modelo de embeddings
  getMcpClient()
    .then(() => console.log('  MCP Server conectado (en memoria)'))
    .catch((err) => console.error('  Error al iniciar el MCP Server:', err.message));
  warmUp().then(() => console.log('  RAG listo'));
});

async function shutdown() {
  console.log('Cerrando...');
  server.close();
  await closeMcpClient();
  await closePool().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
