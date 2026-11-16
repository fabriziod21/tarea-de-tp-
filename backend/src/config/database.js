// backend/src/config/database.js
// El pool vive en el MCP Server (que es quien consulta PostgreSQL).
// Aquí solo se reexporta para scripts como test-db.js.
require('./env');
module.exports = require('@chatbot/mcp-server/src/config/database');
