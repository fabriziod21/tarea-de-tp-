// backend/src/services/mcpClient.service.js
// MCP Client: se conecta al MCP Server EN MEMORIA (mismo proceso, sin HTTP),
// tal como define la decisión de arquitectura de la guía.
// Claude nunca toca PostgreSQL: pide herramientas y el MCP Server las ejecuta.
require('../config/env');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { createMcpServer } = require('@chatbot/mcp-server');

let clientPromise = null;
let server = null;

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  server = createMcpServer();
  await server.connect(serverTransport);

  const client = new Client({ name: 'chatbot-backend', version: '1.0.0' });
  await client.connect(clientTransport);
  return client;
}

function getMcpClient() {
  if (!clientPromise) {
    clientPromise = connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/**
 * Herramientas del MCP Server en el formato que espera la API de Claude.
 * Se ordenan por nombre para que la lista sea siempre idéntica
 * (requisito para que funcione el prompt caching).
 */
async function getClaudeTools() {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  return tools
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Ejecuta una herramienta. Devuelve { text, isError, data }.
 * `data` es el JSON parseado (si la herramienta devolvió JSON).
 */
async function callTool(name, args) {
  const client = await getMcpClient();
  const result = await client.callTool({ name, arguments: args || {} });
  const text = (result.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  let data = null;
  if (!result.isError) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { text, isError: Boolean(result.isError), data };
}

async function closeMcpClient() {
  if (!clientPromise) return;
  const client = await clientPromise.catch(() => null);
  clientPromise = null;
  await client?.close().catch(() => {});
  await server?.close().catch(() => {});
}

module.exports = { getMcpClient, getClaudeTools, callTool, closeMcpClient };
