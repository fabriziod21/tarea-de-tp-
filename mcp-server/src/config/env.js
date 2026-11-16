// mcp-server/src/config/env.js
// Carga UNA sola vez las variables de entorno. El archivo oficial es
// backend/.env (como dice la guía); así el backend y el MCP Server
// —incluso cuando Claude Code lo lanza por stdio— leen las mismas claves.
//
// IMPORTANTE: en modo stdio, todo lo que se escriba en stdout rompe el
// protocolo MCP. Por eso dotenv va en modo silencioso.
const fs = require('fs');
const path = require('path');

let loaded = false;

function loadEnv() {
  if (loaded) return;
  loaded = true;

  const candidates = [
    process.env.DOTENV_PATH,
    path.resolve(__dirname, '../../../backend/.env'),
    path.resolve(process.cwd(), '.env'),
  ].filter(Boolean);

  const file = candidates.find((p) => fs.existsSync(p));
  if (file) {
    require('dotenv').config({ path: file, quiet: true });
  }
}

loadEnv();

module.exports = { loadEnv };
