// mcp-server/src/server.js
// Crea el MCP Server con todas las herramientas. Se usa de dos formas:
//   1. Dentro del backend (InMemoryTransport): sin HTTP, latencia ~0 (decisión de la guía).
//   2. Por stdio (src/index.js): para conectar Claude Code / Claude Desktop a tu BD.
require('./config/env');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');

const TOOLS = [
  require('./tools/listTables.tool'),
  require('./tools/describeTable.tool'),
  require('./tools/getRelationships.tool'),
  require('./tools/runReadonlyQuery.tool'),
  require('./tools/reniecQuery.tool'),
  require('./tools/sunatQuery.tool'),
];

function toToolResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

function createMcpServer() {
  const server = new McpServer({
    name: process.env.MCP_SERVER_NAME || 'postgres-mcp-server',
    version: '1.0.0',
  });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: Boolean(tool.openWorld),
        },
      },
      async (args) => {
        try {
          return toToolResult(await tool.handler(args || {}));
        } catch (err) {
          // El error vuelve al agente como resultado (isError) para que pueda corregir su SQL
          return { isError: true, content: [{ type: 'text', text: err.message }] };
        }
      }
    );
  }

  return server;
}

module.exports = { createMcpServer, TOOLS };
