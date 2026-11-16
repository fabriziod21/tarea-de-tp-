// backend/src/services/sqlValidator.service.js
// El validador vive en el MCP Server (es quien ejecuta el SQL).
// Se reexporta aquí para no duplicar la lógica en dos lugares.
module.exports = require('@chatbot/mcp-server/src/services/sqlValidator.service');
