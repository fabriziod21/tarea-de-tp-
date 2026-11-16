import { useEffect, useMemo, useRef, useState } from 'react';
import TermDialog from './TermDialog.jsx';
import { getVectorStore, searchVectorStore } from '../services/chatApi';

const EXAMPLES = ['¿cuánto facturamos este mes?', 'cliente frecuente', 'productos sin stock'];

function Vector({ values, dims }) {
  return (
    <span className="rv-vector" title={`Vector de ${dims} números (se muestran los primeros ${values.length})`}>
      [{values.map((v) => v.toFixed(3)).join(', ')}, … <span className="dim">{dims}d</span>]
    </span>
  );
}

function Chunk({ chunk, dims, open, rank, onToggle }) {
  return (
    <li className={`rv-chunk${rank ? ' is-hit' : ''}`} data-id={chunk.id}>
      <button type="button" className="rv-chunk-head" onClick={onToggle} aria-expanded={open}>
        <span className="rv-caret">{open ? '▾' : '▸'}</span>
        <span className="rv-id">#{chunk.id.split('#').pop()}</span>
        <span className="rv-title">{chunk.title.split(' › ').pop()}</span>
        {rank && <span className="rv-rank">top {rank}</span>}
        <Vector values={chunk.vector} dims={dims} />
      </button>
      {open && <pre className="rv-text">{chunk.text}</pre>}
    </li>
  );
}

function Results({ search, onPick }) {
  return (
    <div className="rv-results">
      <p className="rv-results-head">
        <span className="violet">◆</span> los {search.results.length} más parecidos a “{search.query}”
        <span className="dim">
          {' '}
          · {search.provider} · {search.durationMs} ms
        </span>
      </p>
      <ol>
        {search.results.map((r, i) => (
          <li key={r.id}>
            <button type="button" className={r.sentToClaude ? '' : 'is-out'} onClick={() => onPick(r.id)}>
              <span className="rv-n">{i + 1}</span>
              <span className="rv-score">{r.score.toFixed(3)}</span>
              <span className="rv-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(0, Math.min(1, r.score)) * 100}%` }} />
              </span>
              <span className="rv-rtitle">{r.title}</span>
              <span className="rv-flag">{r.sentToClaude ? '→ claude' : `< ${search.minScore}`}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Se monta cada vez que se abre la ventana: siempre muestra lo que hay ahora en la base. */
function RagBody({ initialQuery }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(null);
  const [searching, setSearching] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const listRef = useRef(null);

  useEffect(() => {
    getVectorStore()
      .then(setData)
      .catch((err) => setError(err.message));
    if (initialQuery) runSearch(initialQuery); // la demo abre la ventana con una búsqueda lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fragmentos agrupados por documento (.md)
  const groups = useMemo(() => {
    const bySource = new Map();
    for (const c of data?.chunks || []) {
      if (!bySource.has(c.source)) bySource.set(c.source, { source: c.source, title: c.title.split(' › ')[0], chunks: [] });
      bySource.get(c.source).chunks.push(c);
    }
    return [...bySource.values()];
  }, [data]);

  const ranks = useMemo(() => new Map((search?.results || []).map((r, i) => [r.id, i + 1])), [search]);

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reveal(id) {
    setOpenIds((prev) => new Set(prev).add(id));
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    );
  }

  async function runSearch(text) {
    const q = text.trim();
    if (!q || searching) return;
    setQuery(q);
    setSearching(true);
    setError(null);
    try {
      setSearch(await searchVectorStore(q));
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  const fallback = data?.provider.includes('respaldo');

  return (
    <>
      {data && (
        <div className="dlg-meta">
          <span className={fallback ? 'warn' : undefined}>
            <span className="violet">◆</span> {data.provider}
          </span>
          <span>colección {data.collection}</span>
          {data.url && <span>{data.url.replace(/^https?:\/\//, '')}</span>}
          <span>
            {data.chunks.length} fragmentos · {groups.length} documentos
          </span>
          <span>{data.dimensions} dimensiones</span>
          <span title={data.model}>{data.model.split('/').pop()}</span>
        </div>
      )}

      <form
        className="rv-search"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
      >
        <span className="violet" aria-hidden="true">
          ◆
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="busca por significado, como lo hace el bot…"
          aria-label="Buscar en la base vectorial"
          maxLength={500}
        />
        <button type="submit" className="btn-ghost small" disabled={!query.trim() || searching}>
          {searching ? 'buscando…' : 'buscar'}
        </button>
      </form>

      {search ? (
        <Results search={search} onPick={reveal} />
      ) : (
        <div className="rv-examples">
          <span className="dim">prueba:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="suggestion" onClick={() => runSearch(ex)} disabled={searching}>
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="dlg-body" ref={listRef}>
        {error && <p className="err dlg-msg">✗ {error}</p>}
        {!data && !error && <p className="dim dlg-msg">◆ leyendo la base vectorial…</p>}
        {groups.map((g) => (
          <section key={g.source} className="rv-doc">
            <p className="rv-doc-head">
              <span className="orange">{g.source}</span>
              <span className="dim">
                {' '}
                · {g.title} · {g.chunks.length} fragmentos
              </span>
            </p>
            <ul>
              {g.chunks.map((c) => (
                <Chunk
                  key={c.id}
                  chunk={c}
                  dims={data.dimensions}
                  open={openIds.has(c.id)}
                  rank={ranks.get(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="dlg-foot">
        Cada sección <code>##</code> de <code>rag/documents/*.md</code> se guardó como un vector de {data?.dimensions || 384} números.
        Al preguntar, la pregunta también se vectoriza, la base devuelve los 4 más cercanos y los que superan{' '}
        {data?.minScore ?? 0.25} se envían a Claude. Si cambias los documentos, ejecuta <code>npm run rag:index</code>.
      </footer>
    </>
  );
}

/** Ventana con el contenido de la base vectorial (ChromaDB / pgvector / índice local). */
export default function RagViewer({ open, onClose, provider, initialQuery }) {
  return (
    <TermDialog open={open} onClose={onClose} title={`${provider || 'rag'}@chatbot: ~ base vectorial`} label="Base vectorial">
      <RagBody initialQuery={initialQuery} />
    </TermDialog>
  );
}
