import { useCallback, useEffect, useRef, useState } from 'react';
import { streamMessage, getHealth } from '../services/chatApi';
import ClawdTerminal, { TermHead } from './ClawdTerminal.jsx';
import SystemPanel from './SystemPanel.jsx';
import MessageBubble from './MessageBubble.jsx';
import ChatInput from './ChatInput.jsx';
import Spinner from './Spinner.jsx';
import TopBar from './TopBar.jsx';
import PromptViewer from './PromptViewer.jsx';
import RagViewer from './RagViewer.jsx';
import AuditViewer from './AuditViewer.jsx';
import DemoBar from './DemoBar.jsx';
import { DEMO_STEPS } from './demoSteps.js';

const SUGGESTIONS = [
  '¿Quién es el cliente con DNI 12345678 y cuántos pedidos tiene?',
  '¿Cuánto vendimos este mes y cuál fue el ticket promedio?',
  '¿Cuáles son los 5 productos más vendidos?',
  '¿Qué productos tienen stock bajo?',
];

const HELP = `Comandos
  /help    muestra esta ayuda
  /clear   empieza una conversación nueva
  /sql     muestra u oculta el SQL ejecutado (también shift+tab)
  /prompt  abre el prompt de sistema que recibe Claude
  /rag     abre la base vectorial (ChromaDB) y prueba búsquedas
  /audit   abre el registro de auditoría (backend/logs/audit.log)
  /demo    inicia la demo guiada para presentar el proyecto

Atajos
  enter        enviar          shift+enter  salto de línea
  ↑ / ↓        historial       esc          interrumpir a Clawd`;

// Lo que Clawd escribe en su terminal según lo que hace el chat
const CLAWD_STATUS = {
  list_tables: 'clawd --mcp list_tables',
  describe_table: 'clawd --mcp describe_table',
  get_relationships: 'clawd --mcp get_relationships',
  run_readonly_query: 'clawd --sql SELECT …',
  consultar_reniec_dni: 'clawd --reniec dni',
  consultar_sunat_ruc: 'clawd --sunat ruc',
};

let nextId = 0;
const uid = () => `m${++nextId}`;

function Welcome({ onPick, onDemo, disabled }) {
  return (
    <div className="welcome">
      {onDemo && (
        <button type="button" className="demo-start" onClick={onDemo}>
          <span className="demo-tag">▶ demo</span> Presentar el proyecto paso a paso
          <span className="dim"> · {DEMO_STEPS.length} pasos con guion</span>
        </button>
      )}
      <div className="welcome-box">
        <p>
          <span className="orange">✻</span> ¡Bienvenido al <b>Asistente de datos</b>!
        </p>
        <p className="dim">
          <br />
          &nbsp;&nbsp;/help para ver comandos y atajos
          <br />
          &nbsp;&nbsp;/prompt para ver el prompt de sistema · /rag para ver la base vectorial
          <br />
          &nbsp;&nbsp;cwd: postgres://chatbot_urp <span className="ok">(solo lectura)</span>
        </p>
      </div>
      <p className="dim try">Prueba con:</p>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="suggestion" onClick={() => onPick(s)} disabled={disabled}>
            <span className="prompt">&gt;</span> {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatWindow({ user }) {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState(null); // { startedAt, phase, tool, chars }
  const [showSql, setShowSql] = useState(false);
  const [tools, setTools] = useState({});
  const [sources, setSources] = useState({ provider: null, list: [] });
  const [health, setHealth] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [ragOpen, setRagOpen] = useState(false);
  const [ragQuery, setRagQuery] = useState(null); // búsqueda que la demo deja lista
  const [auditOpen, setAuditOpen] = useState(false);
  const [demo, setDemo] = useState(null); // índice del paso actual (null = sin demo)
  const [demoDone, setDemoDone] = useState(() => new Set());

  const clawd = useRef(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    getHealth().then(setHealth);
  }, []);

  // Auto-scroll mientras llega el texto (solo si estabas abajo del todo)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, run]);

  function onScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const interrupt = useCallback(() => abortRef.current?.abort(), []);

  // Esc en cualquier parte de la página también interrumpe (salvo que solo quieras cerrar una ventana)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && abortRef.current && !document.querySelector('dialog[open]')) interrupt();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [interrupt]);

  const toggleSql = useCallback(() => setShowSql((v) => !v), []);

  const updateLast = (fn) =>
    setMessages((prev) => {
      const copy = prev.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });

  function system(content) {
    setMessages((prev) => [...prev, { id: uid(), role: 'system', content }]);
  }

  function clearChat() {
    setMessages([]);
    setTools({});
    setSources({ provider: null, list: [] });
  }

  // ---------- demo guiada ----------
  function startDemo() {
    clearChat();
    setDemoDone(new Set());
    setDemo(0);
    clawd.current?.act('wave', 'clawd --demo ¡empecemos!');
  }

  function goDemo(i) {
    setDemo(Math.max(0, Math.min(DEMO_STEPS.length - 1, i)));
  }

  function runDemoStep() {
    const action = DEMO_STEPS[demo]?.action;
    if (!action || busy) return;
    setDemoDone((prev) => new Set(prev).add(demo));
    if (action.type === 'ask') ask(action.text);
    else if (action.type === 'rag') {
      setRagQuery(action.query);
      setRagOpen(true);
    } else if (action.type === 'prompt') setPromptOpen(true);
    else if (action.type === 'audit') setAuditOpen(true);
  }

  async function ask(text) {
    // Comandos tipo Claude Code
    if (text.startsWith('/')) {
      const cmd = text.split(/\s+/)[0].toLowerCase();
      if (cmd === '/clear') {
        clearChat();
        clawd.current?.act('stretch', 'clawd --clear ✓');
      } else if (cmd === '/demo') {
        startDemo();
      } else if (cmd === '/audit' || cmd === '/log') {
        setAuditOpen(true);
      } else if (cmd === '/sql') {
        toggleSql();
        system(`SQL ${showSql ? 'oculto' : 'visible'} en las próximas respuestas.`);
      } else if (cmd === '/prompt') {
        setPromptOpen(true);
      } else if (cmd === '/rag' || cmd === '/chroma') {
        setRagOpen(true);
      } else {
        system(cmd === '/help' ? HELP : `Comando desconocido: ${cmd}. Escribe /help.`);
      }
      return;
    }

    // Historial para Claude: preguntas y respuestas terminadas (sin errores)
    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.done && m.text && !m.error))
      .map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : m.text }));

    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'user', content: text },
      { id: uid(), role: 'assistant', steps: [], text: '', done: false },
    ]);
    stickToBottom.current = true;
    setBusy(true);
    setRun({ startedAt: Date.now(), phase: 'rag', tool: null, chars: 0 });
    setTools({});
    clawd.current?.busy(true, 'clawd --thinking...');
    clawd.current?.act('think');

    const controller = new AbortController();
    abortRef.current = controller;
    let sawError = false;
    let writing = false;
    const startedTools = new Set();

    function onEvent(event, data) {
      switch (event) {
        case 'status':
          setRun((r) => ({ ...r, phase: data.phase }));
          clawd.current?.status(data.phase === 'rag' ? 'clawd --rag buscando contexto' : 'clawd --thinking...');
          break;

        case 'sources':
          setSources({ provider: data.provider, list: data.sources });
          break;

        case 'tool': {
          updateLast((m) => {
            const i = m.steps.findIndex((s) => s.id === data.id);
            const steps = m.steps.slice();
            if (i >= 0) steps[i] = { ...steps[i], ...data };
            else steps.push(data);
            return { ...m, steps };
          });
          setTools((t) => ({ ...t, [data.tool]: { ...t[data.tool], ...data } }));

          if (data.state === 'running') {
            setRun((r) => ({ ...r, phase: 'tool', tool: data.tool }));
            if (!startedTools.has(data.id)) {
              startedTools.add(data.id);
              clawd.current?.act(sawError ? 'fix' : 'type', CLAWD_STATUS[data.tool]);
            }
          } else if (data.state === 'error') {
            sawError = true;
            clawd.current?.act('bug', '✗ ' + (data.error || 'error').slice(0, 42));
          } else {
            setRun((r) => ({ ...r, phase: 'thinking' }));
          }
          break;
        }

        case 'delta':
          updateLast((m) => ({ ...m, text: m.text + data.text }));
          setRun((r) => ({ ...r, phase: 'writing', chars: r.chars + data.text.length }));
          if (!writing) {
            writing = true;
            clawd.current?.act('type', 'clawd --writing respuesta');
          }
          break;

        case 'reset':
          writing = false;
          updateLast((m) => ({ ...m, text: '' }));
          break;

        case 'done':
          updateLast((m) => ({ ...m, text: data.reply, meta: data.meta, done: true }));
          clawd.current?.busy(false);
          clawd.current?.act('celebrate', `✓ listo en ${(data.meta.durationMs / 1000).toFixed(1)}s`);
          break;

        case 'error':
          updateLast((m) => ({ ...m, error: data.error, done: true }));
          clawd.current?.busy(false);
          clawd.current?.act('bug', '✗ ' + data.error.slice(0, 42));
          break;

        default:
          break;
      }
    }

    try {
      await streamMessage({ message: text, history, showSql }, { onEvent, signal: controller.signal });
    } catch (err) {
      clawd.current?.busy(false);
      if (err.name === 'AbortError') {
        updateLast((m) => ({ ...m, done: true, interrupted: true, steps: m.steps.map((s) => (s.state === 'running' ? { ...s, state: 'error', error: 'interrumpido' } : s)) }));
        clawd.current?.act('think', 'clawd --interrupted');
      } else {
        updateLast((m) => ({ ...m, error: err.message, done: true }));
        clawd.current?.act('bug', '✗ ' + err.message.slice(0, 42));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setRun(null);
    }
  }

  const pastQuestions = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const empty = messages.length === 0;

  return (
    <div className="app">
      <TopBar user={user} health={health} onOpenPrompt={() => setPromptOpen(true)} onOpenRag={() => setRagOpen(true)} />
      <PromptViewer open={promptOpen} onClose={() => setPromptOpen(false)} />
      <RagViewer
        open={ragOpen}
        onClose={() => {
          setRagOpen(false);
          setRagQuery(null);
        }}
        provider={health?.rag}
        initialQuery={ragQuery}
      />
      <AuditViewer open={auditOpen} onClose={() => setAuditOpen(false)} />
      {user.dev && <div className="dev-banner">modo desarrollo · login desactivado (AUTH_DISABLED=true)</div>}
      {demo !== null && (
        <DemoBar index={demo} done={demoDone} busy={busy} onRun={runDemoStep} onGo={goDemo} onClose={() => setDemo(null)} />
      )}

      <main className="workspace">
        <aside className="side">
          <ClawdTerminal ref={clawd} greeting="clawd --hola ¡pregúntame algo!" />
          <SystemPanel tools={tools} sources={sources} health={health} onOpenRag={() => setRagOpen(true)} />
        </aside>

        <section className="term chat-term" aria-label="Conversación">
          <TermHead title={`${user.dev ? 'tú' : (user.email || 'tú').split('@')[0]}@chatbot: ~/sprint4 — claude`}>
            {!empty && (
              <button type="button" className="btn-ghost small" onClick={() => ask('/clear')} disabled={busy}>
                /clear
              </button>
            )}
          </TermHead>

          <div className="transcript" ref={scrollRef} onScroll={onScroll} role="log" aria-live="polite">
            {empty ? (
              <Welcome onPick={ask} onDemo={demo === null ? startDemo : null} disabled={busy} />
            ) : (
              messages.map((m) => <MessageBubble key={m.id} message={m} />)
            )}
            {run && <Spinner run={run} />}
          </div>

          <ChatInput
            onSend={ask}
            onInterrupt={interrupt}
            onToggleSql={toggleSql}
            busy={busy}
            showSql={showSql}
            pastQuestions={pastQuestions}
          />
        </section>
      </main>
    </div>
  );
}
