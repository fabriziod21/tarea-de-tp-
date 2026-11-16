import { useEffect, useState } from 'react';
import { watchUser } from './services/firebase';
import Login from './components/Login.jsx';
import ChatWindow from './components/ChatWindow.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = cargando

  useEffect(() => watchUser((u) => setUser(u || null)), []);

  if (user === undefined) {
    return (
      <div className="splash">
        <span className="orange">✻</span> clawd --booting<span className="caret">_</span>
      </div>
    );
  }

  return user ? <ChatWindow user={user} /> : <Login />;
}
