// backend/src/controllers/audit.controller.js
// Últimas entradas del Audit Logger para mostrarlas en la web (demo del Módulo 8).
// Cada usuario ve SOLO sus propias entradas.
const fs = require('fs/promises');
const { LOG_FILE } = require('../logs/auditLogger');

const TAIL_BYTES = 256 * 1024; // solo se lee el final del archivo
const MAX_ENTRIES = 50;

async function readTail(file, bytes) {
  let handle;
  try {
    handle = await fs.open(file, 'r');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - bytes);
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(size - start), 0, size - start, start);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text; // la primera línea puede venir cortada
  } finally {
    await handle.close();
  }
}

/** GET /api/audit/recent?limit=15 -> entradas más recientes del usuario (la más nueva primero). */
async function getRecentAudit(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 15, 1), MAX_ENTRIES);
  const lines = (await readTail(LOG_FILE, TAIL_BYTES)).split('\n').filter(Boolean);

  const entries = [];
  for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.user_id === req.user.uid) entries.push(entry);
    } catch {
      // línea incompleta o corrupta: se ignora
    }
  }
  res.json({ success: true, file: 'backend/logs/audit.log', entries });
}

module.exports = { getRecentAudit };
