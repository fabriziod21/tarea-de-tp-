import { useState } from 'react';
import { DEMO_STEPS, ACTION_LABEL } from './demoSteps.js';

/** Barra del modo demo: paso actual, qué decir y un botón que ejecuta el paso. */
export default function DemoBar({ index, done, busy, onRun, onGo, onClose }) {
  const [notes, setNotes] = useState(true);
  const step = DEMO_STEPS[index];
  const last = index === DEMO_STEPS.length - 1;
  const ran = done.has(index);

  return (
    <section className="demo-bar" aria-label="Guion de la demo">
      <div className="demo-top">
        <span className="demo-tag">▶ demo</span>
        <ol className="demo-dots" aria-hidden="true">
          {DEMO_STEPS.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                className={`${i === index ? 'is-current' : ''} ${done.has(i) ? 'is-done' : ''}`}
                onClick={() => onGo(i)}
                title={`${i + 1}. ${s.title}`}
                tabIndex={-1}
              />
            </li>
          ))}
        </ol>
        <span className="demo-title">
          <span className="dim">{index + 1}/{DEMO_STEPS.length}</span> {step.title}
        </span>
        <span className="demo-actions">
          {step.action && (
            <button type="button" className={`demo-run${ran ? ' is-ran' : ''}`} onClick={onRun} disabled={busy}>
              {ran ? '↻' : '▶'} {ACTION_LABEL[step.action.type]}
            </button>
          )}
          <button type="button" className="btn-ghost small" onClick={() => onGo(index - 1)} disabled={index === 0}>
            ‹
          </button>
          <button type="button" className="btn-ghost small" onClick={() => (last ? onClose() : onGo(index + 1))}>
            {last ? 'terminar ✓' : 'siguiente ›'}
          </button>
          <button type="button" className="btn-ghost small" onClick={() => setNotes((v) => !v)} aria-pressed={notes}>
            {notes ? 'ocultar guion' : 'guion'}
          </button>
          <button type="button" className="btn-ghost small" onClick={onClose} aria-label="Salir de la demo">
            ✕
          </button>
        </span>
      </div>

      {notes && (
        <div className="demo-notes">
          {step.action?.type === 'ask' && (
            <p className="demo-q">
              <span className="prompt">&gt;</span> {step.action.text}
            </p>
          )}
          <p className="demo-say">
            <span className="demo-label">di</span>
            {step.say}
          </p>
          {step.tip && (
            <p className="demo-tip">
              <span className="demo-label">mira</span>
              {step.tip}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
