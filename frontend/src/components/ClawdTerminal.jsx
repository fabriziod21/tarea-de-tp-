import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/** Ventana de terminal con los tres puntos de colores. */
export function TermHead({ title, children }) {
  return (
    <header className="term-head">
      <span className="dots" aria-hidden="true">
        <i className="d-red" />
        <i className="d-yellow" />
        <i className="d-green" />
      </span>
      <span className="term-title">{title}</span>
      {children && <span className="term-extra">{children}</span>}
    </header>
  );
}

/** Clawd en pixel art: respaldo si el navegador no tiene WebGL. */
function ClawdSprite() {
  return (
    <svg className="clawd-sprite" viewBox="0 0 107 118" width="140" height="154" shapeRendering="crispEdges" aria-hidden="true">
      {[11, 32, 64, 85].map((x) => (
        <rect key={x} x={x} y="60" width="11" height="26" fill="#DD775B" />
      ))}
      <rect x="11" y="0" width="85" height="65" fill="#DD775B" />
      <rect x="85" y="21" width="22" height="23" fill="#DD775B" />
      <rect x="0" y="21" width="22" height="23" fill="#DD775B" />
      <rect x="75" y="11" width="11" height="11" fill="#111" />
      <rect x="21" y="11" width="11" height="11" fill="#111" />
      <rect x="12" y="112" width="83" height="6" fill="#2f2f33" />
      <rect x="22" y="88" width="63" height="24" fill="#1c1c20" />
      <rect x="27" y="92" width="53" height="16" fill="#05080a" />
      <rect x="31" y="96" width="26" height="3" fill="#ff0040" />
      <rect x="31" y="102" width="38" height="3" fill="#4f7cff" />
    </svg>
  );
}

/**
 * Terminal con Clawd 3D (public/clawd/clawd-3d.js, el mismo de tu portafolio).
 * Con ref se controla desde el chat: ref.current.act('think') · busy(true) · status('texto').
 */
const ClawdTerminal = forwardRef(function ClawdTerminal({ title = 'clawd@chatbot:~$ ./clawd --run', greeting, className = '' }, ref) {
  const termRef = useRef(null);
  const statusRef = useRef(null);
  const [mode, setMode] = useState('loading'); // loading | 3d | sprite

  useImperativeHandle(
    ref,
    () => ({
      act: (name, status) => termRef.current?.clawd3d?.act(name, status),
      busy: (on, status) => termRef.current?.clawd3d?.busy(on, status),
      status: (text) => {
        if (termRef.current?.clawd3d) termRef.current.clawd3d.status(text);
        else if (statusRef.current) statusRef.current.textContent = text;
      },
    }),
    []
  );

  useEffect(() => {
    const term = termRef.current;
    if (!term || term.dataset.mounted) return; // React StrictMode monta dos veces en desarrollo
    term.dataset.mounted = '1';
    statusRef.current.textContent = 'clawd --booting';

    const onReady = () => {
      if (greeting) term.clawd3d?.act('wave', greeting);
    };
    term.addEventListener('clawd:ready', onReady, { once: true });

    const ok = Boolean(window.Clawd3D?.mount(term, statusRef.current));
    setMode(ok ? '3d' : 'sprite');
    if (!ok) statusRef.current.textContent = greeting || 'clawd --ready';
  }, [greeting]);

  return (
    <section className={`term clawd-term ${className}`} ref={termRef} aria-label="Clawd, la mascota de Claude Code">
      <TermHead title={title} />
      <div className="clawd-screen">
        <div className="clawd-stage">{mode === 'sprite' && <ClawdSprite />}</div>
        <div className="clawd-statusline">
          <span className="clawd-prompt">&gt;</span>
          <span className="clawd-status" ref={statusRef} />
          <span className="clawd-caret">_</span>
        </div>
      </div>
    </section>
  );
});

export default ClawdTerminal;
