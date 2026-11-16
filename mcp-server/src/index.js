#!/usr/bin/env node
// mcp-server/src/index.js
// Punto de entrada por stdio. Permite que Claude Code (o Claude Desktop)
// use las mismas herramientas que el chatbot. Ver .mcp.json en la raíz.
//
// Nunca uses console.log aquí: stdout es el canal del protocolo MCP.
require('./config/env');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { createMcpServer } = require('./server');
const { closePool } = require('./config/database');

async function main() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
  console.error('[mcp-server] listo por stdio');

  const shutdown = async () => {
    await server.close().catch(() => {});
    await closePool().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[mcp-server] error al iniciar:', err);
  process.exit(1);
});
