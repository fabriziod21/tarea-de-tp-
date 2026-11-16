// rag/scripts/loadDocuments.js
//   npm run load -w rag
// Muestra cómo quedan divididos los documentos en fragmentos (sin vectorizar).
const { loadDocuments } = require('../lib/documents');

const chunks = loadDocuments();
console.log(`${chunks.length} fragmentos en rag/documents:\n`);
for (const c of chunks) {
  console.log(`- [${c.id}] ${c.title}  (${c.text.length} caracteres)`);
}
