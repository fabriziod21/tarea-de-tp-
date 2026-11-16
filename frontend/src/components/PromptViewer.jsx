import { useEffect, useState } from 'react';
import TermDialog from './TermDialog.jsx';
import { TOOLS } from './tools.js';
import { getSystemPrompt } from '../services/chatApi';

// Resalta los nombres de herramientas MCP y la etiqueta del contexto RAG
const TOKEN_RE = new RegExp(`(\\b(?:${TOOLS.map((t) => t.name).join('|')})\\b|<contexto_negocio>)`, 'g');

function highlight(text) {
  return text.split(TOKEN_RE).map((part, i) => (i % 2 ? <span key={i} className="pv-tool">{part}</span> : part));
}

function Line({ text, n }) {
  const heading = /^[^\s-].{0,60}:$/.test(text);
  const bullet = text.startsWith('- ');
  return (
    <li className={heading ? 'pv-h' : bullet ? 'pv-li' : undefined}>
      <span className="pv-ln">{n}</span>
      <span className="pv-text">
        {bullet ? (
          <>
            <span className="pv-bullet">- </span>
            {highlight(text.slice(2))}
          </>
        ) : (
          highlight(text)
        )}
      </span>
    </li>
  );
}

/** Se monta cada vez que se abre la ventana: si editaste el prompt, ves la versión nueva. */
function PromptBody() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getSystemPrompt()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  const lines = data?.prompt.split('\n') || [];
  const chars = data?.prompt.length || 0;

  return (
    <>
      {data && (
        <div className="dlg-meta">
          <span>
            <span className="orange">✻</span> prompt de sistema
          </span>
          <span>{lines.length} líneas</span>
          <span>{chars.toLocaleString('es-PE')} caracteres</span>
          <span>≈ {Math.round(chars / 3.5).toLocaleString('es-PE')} tokens</span>
          <span>{data.model}</span>
          <button type="button" className="btn-ghost small dlg-meta-action" onClick={copy}>
            {copied ? 'copiado ✓' : 'copiar'}
          </button>
        </div>
      )}

      <div className="dlg-body">
        {error && <p className="err dlg-msg">✗ {error}</p>}
        {!data && !error && <p className="dim dlg-msg">✻ leyendo el prompt…</p>}
        {data && (
          <ol className="pv-lines">
            {lines.map((text, i) => (
              <Line key={i} text={text} n={i + 1} />
            ))}
          </ol>
        )}
      </div>

      <footer className="dlg-foot">
        Claude lo recibe en cada pregunta, junto con el contexto del RAG (<span className="pv-tool">&lt;contexto_negocio&gt;</span>) y
        el historial. Para cambiarlo, edita <code>{data?.file || 'backend/src/services/aiAgent.service.js'}</code>; el backend se
        reinicia solo.
      </footer>
    </>
  );
}

/** Ventana con el prompt de sistema que recibe Claude (solo lectura). */
export default function PromptViewer({ open, onClose }) {
  return (
    <TermDialog open={open} onClose={onClose} title="~/sprint4 — cat system-prompt.md" label="Prompt de sistema">
      <PromptBody />
    </TermDialog>
  );
}
