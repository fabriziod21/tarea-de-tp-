// rag/lib/documents.js
// Lee los .md de rag/documents y los divide en fragmentos (chunks):
// un fragmento por cada sección "## ". Así cada vector representa una
// idea concreta (una tabla, una regla, un ejemplo SQL).
const fs = require('fs');
const path = require('path');
const config = require('./config');

function splitMarkdown(source, content) {
  const docTitle = (content.match(/^#\s+(.+)$/m) || [])[1] || source;
  const sections = content.split(/^##\s+/m).slice(1);

  if (sections.length === 0) {
    return [{ id: `${source}#0`, source, title: docTitle, text: content.trim() }];
  }

  return sections.map((section, i) => {
    const [heading, ...body] = section.split('\n');
    return {
      id: `${source}#${i + 1}`,
      source,
      title: `${docTitle} › ${heading.trim()}`,
      text: `${heading.trim()}\n${body.join('\n').trim()}`,
    };
  });
}

function loadDocuments(dir = config.documentsDir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(md|txt)$/i.test(f))
    .sort();

  return files.flatMap((file) => splitMarkdown(file, fs.readFileSync(path.join(dir, file), 'utf8')));
}

module.exports = { loadDocuments, splitMarkdown };
