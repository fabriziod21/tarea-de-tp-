import { TermHead } from './ClawdTerminal.jsx';
import { TOOLS, toolResultText } from './tools.js';

function Dot({ state }) {
  return <span className={`sdot sdot-${state || 'idle'}`} aria-hidden="true" />;
}

/** Panel en vivo: herramientas MCP, contexto RAG y estado del sistema. */
export default function SystemPanel({ tools, sources, health, onOpenRag }) {
  return (
    <section className="term system-term" aria-label="Estado del sistema">
      <TermHead title="mcp@chatbot:~$ tools --watch" />
      <div className="system-body">
        <p className="sys-label">herramientas mcp</p>
        <ul className="tool-list">
          {TOOLS.map((t) => {
            const s = tools[t.name];
            return (
              <li key={t.name} className={`tool-row tool-${s?.state || 'idle'}`}>
                <Dot state={s?.state} />
                <span className="tool-name">{t.name}</span>
                <span className="tool-info">{s ? toolResultText(s) : '—'}</span>
              </li>
            );
          })}
        </ul>

        <p className="sys-label sys-label-row">
          <span>contexto rag {sources.provider && <span className="dim">· {sources.provider}</span>}</span>
          <button type="button" className="link small" onClick={onOpenRag}>
            ver base ↗
          </button>
        </p>
        {sources.list.length ? (
          <ul className="source-list">
            {sources.list.map((s) => (
              <li key={s}>{s.split(' › ').pop()}</li>
            ))}
          </ul>
        ) : (
          <p className="dim small">Aparece al hacer una pregunta.</p>
        )}

        <p className="sys-label">sistema</p>
        <dl className="sys-grid">
          <dt>postgres</dt>
          <dd>
            <Dot state={health ? (health.db === 'ok' ? 'ok' : 'error') : 'idle'} />
            {health ? (health.db === 'ok' ? 'conectado · solo lectura' : 'sin conexión') : '…'}
          </dd>
          <dt>claude</dt>
          <dd>
            <Dot state={health ? 'ok' : 'idle'} />
            {health?.claude || '…'}
          </dd>
          <dt>rag</dt>
          <dd>
            <Dot state={health ? 'ok' : 'idle'} />
            {health?.rag || '…'}
          </dd>
          <dt>reniec</dt>
          <dd>
            <Dot state={health ? (health.reniec === 'simulado' ? 'warn' : 'ok') : 'idle'} />
            {health?.reniec || '…'}
          </dd>
        </dl>
      </div>
    </section>
  );
}
