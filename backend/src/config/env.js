// backend/src/config/env.js
// Carga backend/.env (una sola vez, compartido con el MCP Server).
require('@chatbot/mcp-server/src/config/env');

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  port: Number(process.env.PORT || 3001),
  // En desarrollo solo se escucha en tu PC (127.0.0.1): nadie de tu red Wi-Fi puede
  // entrar. En producción (Render) hay que escuchar en todas las interfaces.
  host: process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1'),
  isProduction,
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // AUTH_DISABLED solo funciona fuera de producción (para desarrollar sin Firebase)
  authDisabled: process.env.AUTH_DISABLED === 'true' && !isProduction,
  claude: {
    // api = Claude API con ANTHROPIC_API_KEY · code = tu Claude Code (solo en tu PC)
    provider: (process.env.CLAUDE_PROVIDER || 'api').toLowerCase() === 'code' ? 'code' : 'api',
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    effort: process.env.CLAUDE_EFFORT || 'medium',
    fallbacks: process.env.CLAUDE_FALLBACKS || 'default',
    maxToolRounds: Number(process.env.CLAUDE_MAX_TOOL_ROUNDS || 8),
  },
};

module.exports = config;
