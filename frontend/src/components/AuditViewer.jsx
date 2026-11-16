import { useEffect, useState } from 'react';
import TermDialog from './TermDialog.jsx';
import { getRecentAudit } from '../services/chatApi';

const time = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Resumen de una línea del log según su tipo. */
function describe(e) {
  if (e.type === 'chat') {
    const tools = e.tools?.length ? e.tools.join(', ') : 'sin herramientas';
    return { main: e.question, detail: `${tools} · ${(e.duration_ms / 1000).toFixed(1)} s` };
  }
  if (e.type === 'sql') {
    const result = e.error || `${e.row_count} fila${e.row_count === 1 ? '' : 's'} · ${e.execution_ms} ms`;
    return { main: e.sql, detail: result };
  }
  if (e.type === 'reniec') return { main: `${e.tipo} ${e.numero}`, detail: e.ok ? 'ok' : e.error || 'error' };
  return { main: e.type, detail: '' };
}

function Entry({ entry }) {
  const [open, setOpen] = useState(false);
  const { main, detail } = describe(entry);
  return (
    <li className={`au-entry au-${entry.type}${entry.error ? ' is-error' : ''}`}>
      <button type="button" className="au-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="au-time">{time(entry.timestamp)}</span>
        <span className="au-type">
          {entry.type}
          {entry.error ? ' ✗' : ''}
        </span>
        <span className="au-main">{main}</span>
        <span className="au-detail">{detail}</span>
      </button>
      {open && <pre className="au-json">{JSON.stringify(entry, null, 2)}</pre>}
    </li>
  );
}

function AuditBody() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    setError(null);
    getRecentAudit(20)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  return (
    <>
      <div className="dlg-meta">
        <span>
          <span className="ok">●</span> audit logger
        </span>
        <span>{data?.file || 'backend/logs/audit.log'}</span>
        <span>una línea JSON por operación</span>
        {data && <span>{data.entries.length} recientes (solo tuyas)</span>}
        <button type="button" className="btn-ghost small dlg-meta-action" onClick={load}>
          actualizar
        </button>
      </div>
      <div className="dlg-body">
        {error && <p className="err dlg-msg">✗ {error}</p>}
        {!data && !error && <p className="dim dlg-msg">● leyendo el registro…</p>}
        {data && data.entries.length === 0 && <p className="dim dlg-msg">Todavía no hay operaciones registradas. Haz una pregunta.</p>}
        {data && data.entries.length > 0 && (
          <ul className="au-list">
            {data.entries.map((e, i) => (
              <Entry key={`${e.timestamp}-${i}`} entry={e} />
            ))}
          </ul>
        )}
      </div>
      <footer className="dlg-foot">
        Módulo 7, paso 8: se registra cada pregunta (<code>chat</code>), cada SQL ejecutado o rechazado (<code>sql</code>) y cada
        consulta a RENIEC (<code>reniec</code>, con el DNI enmascarado). Haz clic en una línea para ver el JSON completo.
      </footer>
    </>
  );
}

/** Ventana con las últimas operaciones del Audit Logger. */
export default function AuditViewer({ open, onClose }) {
  return (
    <TermDialog open={open} onClose={onClose} title="~/sprint4 — tail backend/logs/audit.log" label="Registro de auditoría">
      <AuditBody />
    </TermDialog>
  );
}
