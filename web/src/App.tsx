import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action } from '../../shared/actions';
import { localToday } from '../../shared/dates';
import type { Workspace } from '../../shared/types';
import { api, errorMessage, loadOrCreateWorkspace } from './api';
import { Icon } from './components/Icon';
import type { IconName } from './components/Icon';
import { AnchorContext } from './state';
import type { AnchorState, ToastTone } from './state';
import { KidView } from './views/KidView';
import { Landing } from './views/Landing';
import { ParentView } from './views/ParentView';
import { TeacherView } from './views/TeacherView';

type Role = 'parent' | 'kid' | 'teacher';
const ROLES: { id: Role; label: string; icon: IconName }[] = [
  { id: 'parent', label: 'Parent', icon: 'home' },
  { id: 'kid', label: 'Kid', icon: 'smile' },
  { id: 'teacher', label: 'Teacher', icon: 'school' },
];

function readRoute(): Role | 'home' {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return ROLES.some((r) => r.id === hash) ? (hash as Role) : 'home';
}

export function App() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return route === 'home' ? <Landing /> : <DemoApp role={route} />;
}

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

function DemoApp({ role }: { role: Role }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resetting, setResetting] = useState(false);
  const today = useMemo(() => localToday(), []);
  const toastId = useRef(0);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000);
  }, []);

  // Keep whichever copy is newest: AI calls can finish after later actions.
  const replace = useCallback((next: Workspace) => {
    setWs((current) => (!current || current.id !== next.id || next.version >= current.version ? next : current));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      setWs(await loadOrCreateWorkspace());
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workspaceId = ws?.id;
  const act = useCallback(
    async (action: Action, success?: string) => {
      if (!workspaceId) return false;
      try {
        replace(await api.act(workspaceId, action));
        if (success) notify(success, 'success');
        return true;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return false;
      }
    },
    [workspaceId, replace, notify],
  );

  const reset = async () => {
    if (!ws || !window.confirm('Reset the demo family to its starting data? Your changes will be cleared.')) return;
    setResetting(true);
    try {
      setWs(await api.resetWorkspace(ws.id));
      notify('Demo family reset to fresh data', 'success');
    } catch (err) {
      notify(errorMessage(err), 'error');
    } finally {
      setResetting(false);
    }
  };

  const state: AnchorState | null = useMemo(
    () => (ws ? { ws, today, act, replace, notify } : null),
    [ws, today, act, replace, notify],
  );

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <a href="#/" className="brand" aria-label="Anchor home">
            <span className="brand-mark">
              <Icon name="anchor" size={18} />
            </span>
            <span className="brand-name">Anchor</span>
          </a>
          <nav className="role-tabs" aria-label="Switch perspective">
            {ROLES.map((r) => (
              <a key={r.id} href={`#/${r.id}`} className="role-tab" aria-current={r.id === role ? 'page' : undefined}>
                <Icon name={r.icon} size={16} />
                <span>{r.label}</span>
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <span className="pill demo-pill" title="Each visitor gets a private demo family with fictional data">
              Demo family
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!ws || resetting}>
              <Icon name="refresh" size={14} />
              <span className="hide-sm">Reset</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page" id="main">
        {state ? (
          <AnchorContext.Provider value={state}>
            {role === 'parent' && <ParentView key={state.ws.createdAt} />}
            {role === 'kid' && <KidView key={state.ws.createdAt} />}
            {role === 'teacher' && <TeacherView key={state.ws.createdAt} />}
          </AnchorContext.Provider>
        ) : error ? (
          <div className="card center-card">
            <h1 className="card-title">Anchor couldn’t load</h1>
            <p className="card-sub">{error}</p>
            <button type="button" className="btn btn-primary" onClick={load}>
              Try again
            </button>
          </div>
        ) : (
          <div className="center-card loading-screen" role="status">
            <span className="brand-mark brand-mark-lg">
              <Icon name="anchor" size={28} />
            </span>
            <p>Setting up your private demo family…</p>
          </div>
        )}
      </main>

      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.tone === 'success' && <Icon name="check" size={16} />}
            {t.tone === 'error' && <Icon name="alert" size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
