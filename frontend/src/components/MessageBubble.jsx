import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TOOL_BY_NAME, toolResultText } from './tools.js';

/** Una llamada a herramienta, como en Claude Code:  ● run_readonly_query(…)  ⎿ 1 fila · 6 ms */
function Step({ step }) {
  const label = TOOL_BY_NAME[step.tool]?.label;
  return (
    <div className={`step step-${step.state}`}>
      <div className="step-call">
        <span className="bullet" aria-hidden="true">●</span>
        <span className="step-name">{step.tool}</span>
        {step.arg ? (
          step.tool === 'run_readonly_query' ? null : <span className="step-arg">({step.arg})</span>
        ) : (
          label && <span className="step-label">{label}</span>
        )}
      </div>
      {step.tool === 'run_readonly_query' && step.arg && <pre className="step-sql">{step.arg}</pre>}
      <div className="step-result">
        <span className="elbow" aria-hidden="true">⎿</span>
        <span>{toolResultText(step)}</span>
      </div>
    </div>
  );
}

function Meta({ meta }) {
  const [open, setOpen] = useState(false);
  const seconds = (meta.durationMs / 1000).toFixed(1);
  const out = meta.usage?.outputTokens;
  const hasDetails = meta.sources?.length > 0 || meta.queries?.length > 0;

  return (
    <div className="meta">
      <span className="elbow" aria-hidden="true">⎿</span>
      <span>
        {seconds}s{out ? ` · ↓ ${out >= 1000 ? `${(out / 1000).toFixed(1)}k` : out} tokens` : ''} · {meta.model}
      </span>
      {hasDetails && (
        <button type="button" className="link" onClick={() => setOpen(!open)}>
          {open ? 'ocultar detalles' : 'detalles'}
        </button>
      )}
      {open && (
        <div className="details">
          {meta.sources?.length > 0 && (
            <>
              <p className="sys-label">contexto rag · {meta.ragProvider}</p>
              <ul className="source-list">
                {meta.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {meta.queries?.map((q, i) => (
            <div key={i}>
              <p className="sys-label">
                sql {meta.queries.length > 1 ? i + 1 : ''} · {q.error ? 'rechazado' : `${q.rowCount} fila(s) · ${q.durationMs} ms`}
              </p>
              <pre className="step-sql">{q.sql}</pre>
              {q.error && <p className="err small">{q.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }) {
  if (message.role === 'user') {
    return (
      <div className="entry entry-user">
        <span className="prompt" aria-hidden="true">&gt;</span>
        <p>{message.content}</p>
      </div>
    );
  }

  if (message.role === 'system') {
    return <div className="entry entry-system">{message.content}</div>;
  }

  // assistant
  const streaming = !message.done;
  return (
    <div className="entry entry-assistant">
      {message.steps.map((step) => (
        <Step key={step.id} step={step} />
      ))}

      {message.text && (
        <div className="answer">
          <span className="bullet bullet-answer" aria-hidden="true">●</span>
          <div className={`markdown ${streaming ? 'is-streaming' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
          </div>
        </div>
      )}

      {message.error && (
        <div className="answer answer-error" role="alert">
          <span className="bullet" aria-hidden="true">●</span>
          <p>{message.error}</p>
        </div>
      )}

      {message.interrupted && (
        <div className="step-result interrupted">
          <span className="elbow" aria-hidden="true">⎿</span>
          <span>Interrumpido por ti</span>
        </div>
      )}

      {message.meta && <Meta meta={message.meta} />}
    </div>
  );
}

export default memo(MessageBubble);
