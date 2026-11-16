// mcp-server/src/tools/sunatQuery.tool.js
// Extra: el servicio de la guía ya tenía consultarRUC, así que también
// se expone como herramienta del agente.
const { z } = require('zod');
const { consultarRUC } = require('../services/reniec.service');

module.exports = {
  name: 'consultar_sunat_ruc',
  title: 'Consultar RUC en SUNAT',
  description:
    'Consulta la razón social, estado y condición de una empresa en SUNAT usando su RUC (11 dígitos). ' +
    'Consume 1 crédito de Json.pe por consulta.',
  inputSchema: {
    ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos').describe('Número de RUC de 11 dígitos'),
  },
  openWorld: true,
  handler: async ({ ruc }) => consultarRUC(ruc),
};
