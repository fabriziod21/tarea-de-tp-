// mcp-server/src/tools/reniecQuery.tool.js
//
// Corrección de la guía: antes hacía require('../../backend/src/services/reniec.service'),
// ruta que desde mcp-server/src/tools apunta a mcp-server/backend/ (no existe).
// Ahora el servicio vive dentro del MCP Server y el backend lo reutiliza.
const { z } = require('zod');
const { consultarDNI } = require('../services/reniec.service');

async function executeReniecTool(input) {
  return consultarDNI(input.dni);
}

module.exports = {
  name: 'consultar_reniec_dni',
  title: 'Consultar DNI en RENIEC',
  description:
    'Consulta el nombre completo de una persona en el RENIEC usando su DNI (8 dígitos). ' +
    'Cada consulta real consume 1 crédito de Json.pe: úsala solo cuando el usuario pregunte por un DNI.',
  inputSchema: {
    dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos').describe('Número de DNI de 8 dígitos'),
  },
  openWorld: true,
  handler: executeReniecTool,
  executeReniecTool,
};
