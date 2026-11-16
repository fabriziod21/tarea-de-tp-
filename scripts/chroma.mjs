// scripts/chroma.mjs
// ChromaDB LOCAL (base de datos vectorial de desarrollo, Módulo 2 de la guía).
// No necesita cuenta ni Docker: se instala con Python en .venv-chroma/ (ignorado por git)
// y guarda los vectores en chroma_db/.
//
//   npm run chroma:setup   -> instala ChromaDB (una sola vez, requiere Python 3.10+)
//   npm run chroma         -> enciende ChromaDB en http://127.0.0.1:8000
//   npm run dev            -> lo enciende solo si RAG_PROVIDER=chroma
//
// En producción la guía usa pgvector dentro de Neon (RAG_PROVIDER=pgvector).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require('dotenv').config({ path: path.join(root, 'backend/.env'), quiet: true });

const isWin = process.platform === 'win32';
const venv = path.join(root, '.venv-chroma');
const venvBin = (name) => path.join(venv, isWin ? 'Scripts' : 'bin', isWin ? `${name}.exe` : name);
const run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;

// ---------- npm run chroma:setup ----------
if (process.argv.includes('setup')) {
  if (!fs.existsSync(venvBin('python'))) {
    const python = ['python3', 'python', 'py'].find((p) => spawnSync(p, ['--version']).status === 0);
    if (!python) {
      console.error('✖ No se encontró Python. Instálalo desde https://www.python.org (3.10 o superior).');
      process.exit(1);
    }
    console.log(`Creando entorno de Python en .venv-chroma/ (con ${python}) ...`);
    if (!run(python, ['-m', 'venv', venv])) process.exit(1);
  }
  console.log('Instalando chromadb (la primera vez descarga varios cientos de MB) ...');
  if (!run(venvBin('python'), ['-m', 'pip', 'install', '--disable-pip-version-check', 'chromadb'])) process.exit(1);

  // Activa ChromaDB en backend/.env si estaba en el índice local
  const envFile = path.join(root, 'backend/.env');
  if (fs.existsSync(envFile)) {
    const env = fs.readFileSync(envFile, 'utf8');
    if (/^RAG_PROVIDER=local\s*$/m.test(env)) {
      fs.writeFileSync(envFile, env.replace(/^RAG_PROVIDER=local\s*$/m, 'RAG_PROVIDER=chroma'));
      console.log('✔ backend/.env: RAG_PROVIDER=local -> chroma');
    }
  }
  console.log('\n✔ ChromaDB instalado. Ejecuta npm run dev (lo enciende solo y carga los documentos la primera vez).');
  process.exit(0);
}

// ---------- npm run chroma / npm run dev ----------
const provider = (process.env.RAG_PROVIDER || 'local').toLowerCase();
if (process.argv.includes('--if-needed') && provider !== 'chroma') {
  console.log(`RAG_PROVIDER=${provider}: ChromaDB no se necesita.`);
  process.exit(0);
}

const url = new URL(process.env.CHROMA_URL || 'http://127.0.0.1:8000');
const local = ['localhost', '127.0.0.1'].includes(url.hostname);
if (!local) {
  console.log(`CHROMA_URL apunta a ${url.host}: no se enciende un ChromaDB local.`);
  process.exit(0);
}

const port = url.port || '8000';
const cmd = fs.existsSync(venvBin('chroma')) ? venvBin('chroma') : 'chroma';
const child = spawn(cmd, ['run', '--path', path.join(root, 'chroma_db'), '--host', '127.0.0.1', '--port', port], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ANONYMIZED_TELEMETRY: 'False' }, // sin telemetría
});

// ChromaDB registra cada petición: solo mostramos el arranque, avisos y errores
// (npm run chroma -- --verbose muestra todo)
const verbose = process.argv.includes('--verbose');
for (const stream of [child.stdout, child.stderr]) {
  readline.createInterface({ input: stream }).on('line', (line) => {
    if (verbose) console.log(line);
    else if (/listening on address/.test(line)) console.log(`✔ ChromaDB escuchando en http://127.0.0.1:${port} · datos en chroma_db/`);
    else if (/\b(WARN|ERROR)\b|panic|Traceback|Error:/.test(line)) console.log(line.trim());
  });
}

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('✖ ChromaDB no está instalado. Ejecuta: npm run chroma:setup');
    console.error('  Mientras tanto, el RAG usa el índice local (rag/embeddings/index.json).');
    process.exit(0); // no tumba a los demás procesos de npm run dev
  }
  console.error('✖', err.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill());
