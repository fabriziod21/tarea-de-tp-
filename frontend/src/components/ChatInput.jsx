import { useEffect, useRef, useState } from 'react';

const MAX_LENGTH = 2000;

/**
 * Caja de entrada estilo Claude Code.
 *   Enter enviar · Shift+Enter salto de línea · ↑/↓ historial
 *   Esc interrumpir · Shift+Tab mostrar/ocultar SQL · /help /clear /sql
 */
export default function ChatInput({ onSend, onInterrupt, onToggleSql, busy, showSql, pastQuestions }) {
  const [text, setText] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ref = useRef(null);

  // Altura automática del textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    if (!busy) ref.current?.focus();
  }, [busy]);

  function submit() {
    const message = text.trim();
    if (!message || busy) return;
    onSend(message);
    setText('');
    setHistoryIndex(-1);
  }

  function recall(direction) {
    if (!pastQuestions.length) return;
    const next = Math.min(Math.max(historyIndex + direction, -1), pastQuestions.length - 1);
    setHistoryIndex(next);
    setText(next === -1 ? '' : pastQuestions[pastQuestions.length - 1 - next]);
  }

  function onKeyDown(e) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && busy) {
      e.preventDefault();
      onInterrupt();
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      onToggleSql();
    } else if (e.key === 'ArrowUp' && !text.includes('\n') && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      recall(1);
    } else if (e.key === 'ArrowDown' && historyIndex >= 0 && !text.includes('\n')) {
      e.preventDefault();
      recall(-1);
    }
  }

  return (
    <div className="composer">
      <div className={`prompt-box ${busy ? 'is-busy' : ''}`} onClick={() => ref.current?.focus()}>
        <span className="prompt" aria-hidden="true">&gt;</span>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? 'Clawd está trabajando… (esc para interrumpir)' : 'Pregunta sobre clientes, pedidos o productos · /help'}
          aria-label="Escribe tu pregunta"
          spellCheck="false"
        />
        {busy ? (
          <button type="button" className="send stop" onClick={onInterrupt} aria-label="Interrumpir" title="Interrumpir (esc)">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button type="button" className="send" onClick={submit} disabled={!text.trim()} aria-label="Enviar" title="Enviar (enter)">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M5 12h13M12 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="composer-foot">
        <span className="hints">
          <kbd>enter</kbd> enviar · <kbd>↑</kbd> historial · <kbd>esc</kbd> interrumpir · <kbd>/help</kbd>
        </span>
        <button type="button" className={`mode ${showSql ? 'on' : ''}`} onClick={onToggleSql} title="shift+tab">
          ⏵⏵ {showSql ? 'sql visible' : 'solo lectura · sql oculto'} <span className="dim">(shift+tab)</span>
        </button>
      </div>
    </div>
  );
}
