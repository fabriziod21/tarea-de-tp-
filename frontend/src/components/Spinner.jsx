import { useEffect, useState } from 'react';
import { TOOL_BY_NAME } from './tools.js';

// Igual que la línea de estado de Claude Code: ✻ Pensando… (8s · ↓ 0.7k tokens · esc para interrumpir)
const GLYPHS = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const VERBS = ['Pensando', 'Cavilando', 'Clawdeando', 'Maquinando', 'Atando cabos', 'Rumiando'];

export default function Spinner({ run }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, []);

  if (!run) return null;

  let verb;
  if (run.phase === 'rag') verb = 'Buscando contexto del negocio';
  else if (run.phase === 'tool') verb = TOOL_BY_NAME[run.tool]?.verb || 'Usando herramientas';
  else if (run.phase === 'writing') verb = 'Redactando';
  else verb = VERBS[Math.floor((Date.now() - run.startedAt) / 3500) % VERBS.length];

  const seconds = Math.floor((Date.now() - run.startedAt) / 1000);
  const tokens = run.chars / 4;
  const tokenText = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : Math.round(tokens);

  return (
    <div className="spinner" aria-live="polite">
      <span className="spin-glyph">{GLYPHS[tick % GLYPHS.length]}</span>
      <span className="spin-verb">{verb}…</span>
      <span className="spin-meta">
        ({seconds}s{run.chars > 0 && ` · ↓ ${tokenText} tokens`} · <kbd>esc</kbd> para interrumpir)
      </span>
    </div>
  );
}
