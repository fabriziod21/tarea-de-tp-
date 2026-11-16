import { logout } from '../services/firebase';

function Pill({ ok, children }) {
  return (
    <span className="pill">
      <span className={`sdot sdot-${ok === undefined ? 'idle' : ok ? 'ok' : 'error'}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 24 24" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="5" y="5" width="14" height="10" fill="#DD775B" />
        <rect x="2" y="9" width="3" height="3" fill="#DD775B" />
        <rect x="19" y="9" width="3" height="3" fill="#DD775B" />
        {[6, 9, 13, 16].map((x) => (
          <rect key={x} x={x} y="15" width="2" height="4" fill="#DD775B" />
        ))}
        <rect x="8" y="7" width="2" height="2" fill="#111" />
        <rect x="14" y="7" width="2" height="2" fill="#111" />
      </svg>
      <span className="brand-name">clawd</span>
      <span className="brand-sub">/ asistente de datos</span>
    </div>
  );
}

export default function TopBar({ user, health, onOpenPrompt, onOpenRag }) {
  return (
    <header className="topbar">
      <Brand />
      <div className="pills">
        <Pill ok={health ? health.db === 'ok' : undefined}>postgres</Pill>
        <Pill ok={health ? true : undefined}>mcp · 6 tools</Pill>
        <Pill ok={health ? true : undefined}>{health?.claude?.startsWith('claude-code') ? 'claude code' : health?.claude || 'claude'}</Pill>
      </div>
      <div className="user">
        <button type="button" className="btn-ghost top-btn" onClick={onOpenRag} title="Ver la base vectorial del RAG (/rag)">
          <span className="violet">◆</span>
          <span className="btn-label"> {health?.rag === 'chroma' ? 'chroma' : 'rag'}</span>
        </button>
        <button type="button" className="btn-ghost top-btn" onClick={onOpenPrompt} title="Ver el prompt de sistema (/prompt)">
          <span className="orange">✻</span>
          <span className="btn-label"> system prompt</span>
        </button>
        <span className="avatar" aria-hidden="true">
          {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
        </span>
        <span className="user-email">{user.dev ? 'modo desarrollo' : user.email}</span>
        {!user.dev && (
          <button type="button" className="btn-ghost" onClick={logout}>
            salir
          </button>
        )}
      </div>
    </header>
  );
}
