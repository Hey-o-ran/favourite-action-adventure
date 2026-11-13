import { useState, type ReactNode, type FormEvent } from 'react';
import { RegisterForm } from './RegisterForm';

const PASSWORD = 'Haoran';
const UNLOCK_KEY = 'card-casino.unlocked';

function isUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(isUnlocked);
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [view, setView] = useState<'login' | 'register'>('login');

  if (unlocked) return <>{children}</>;
  if (view === 'register') return <RegisterForm onBack={() => setView('login')} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      try {
        window.sessionStorage.setItem(UNLOCK_KEY, '1');
      } catch {
        // Storage blocked: the gate still opens for this page load.
      }
      setUnlocked(true);
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>Card Casino</h1>
        <label>
          Password
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
        </label>
        {error && <p className="login-error">Incorrect password.</p>}
        <button className="primary" type="submit">
          Enter
        </button>
        <button type="button" onClick={() => setView('register')}>
          Register
        </button>
      </form>
    </div>
  );
}
