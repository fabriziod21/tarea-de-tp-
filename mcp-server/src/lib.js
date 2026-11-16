// mcp-server/src/lib.js
// Lo que el backend reutiliza del MCP Server (sin duplicar código).
module.exports = {
  ...require('./server'),
  ...require('./config/database'),
  ...require('./services/sqlValidator.service'),
  ...require('./services/reniec.service'),
};
