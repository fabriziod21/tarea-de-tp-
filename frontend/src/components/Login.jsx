import { useState } from 'react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, authErrorMessage } from '../services/firebase';
import ClawdTerminal, { TermHead } from './ClawdTerminal.jsx';
import { Brand } from './TopBar.jsx';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    run(() => (mode === 'login' ? loginWithEmail(email, password) : registerWithEmail(email, password)));
  }

  return (
    <main className="login">
      <div className="login-head">
        <Brand />
        <p className="dim">Claude · MCP · RAG · PostgreSQL · RENIEC</p>
      </div>

      <div className="login-grid">
        <ClawdTerminal title="clawd@chatbot:~$ ./clawd --login" greeting="clawd --wave ¡hola! inicia sesión" />

        <section className="term auth-term">
          <TermHead title={`auth@chatbot:~$ ./${mode === 'login' ? 'login' : 'register'}`} />
          <div className="auth-body">
            <p>
              <span className="orange">✻</span> {mode === 'login' ? 'Inicia sesión para preguntarle a tus datos.' : 'Crea tu cuenta.'}
            </p>
            <p className="dim small">Solo los usuarios registrados pueden usar el asistente (Firebase Auth).</p>

            <button type="button" className="btn btn-outline" onClick={() => run(loginWithGoogle)} disabled={busy}>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
              </svg>
              continuar con google
            </button>

            <div className="divider">
              <span>o con tu correo</span>
            </div>

            <form onSubmit={onSubmit} className="auth-form">
              <label>
                <span className="dim">email:</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <label>
                <span className="dim">password:</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </label>
              {error && <p className="err small">✗ {error}</p>}
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'conectando…' : mode === 'login' ? 'entrar ⏎' : 'registrarme ⏎'}
              </button>
            </form>

            <p className="dim small switch">
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                {mode === 'login' ? 'regístrate' : 'inicia sesión'}
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
