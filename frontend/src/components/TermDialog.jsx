import { useEffect, useRef } from 'react';
import { TermHead } from './ClawdTerminal.jsx';

/**
 * Ventana modal con forma de terminal (<dialog> nativo: Esc la cierra y el foco queda dentro).
 * Se cierra también con el botón o haciendo clic en el fondo.
 */
export default function TermDialog({ open, onClose, title, label, actions, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="term-dialog"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // clic en el fondo
    >
      <section className="term dialog-term">
        <TermHead title={title}>
          {actions}
          <button type="button" className="btn-ghost small" onClick={onClose} aria-label="Cerrar">
            esc ✕
          </button>
        </TermHead>
        {open && children}
      </section>
    </dialog>
  );
}
