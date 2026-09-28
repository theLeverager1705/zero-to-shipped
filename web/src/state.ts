import { createContext, useContext } from 'react';
import type { Action } from '../../shared/actions';
import type { Workspace } from '../../shared/types';

export type ToastTone = 'info' | 'success' | 'error';

export interface AnchorState {
  ws: Workspace;
  today: string;
  act: (action: Action, success?: string) => Promise<boolean>;
  replace: (ws: Workspace) => void;
  notify: (message: string, tone?: ToastTone) => void;
}

export const AnchorContext = createContext<AnchorState | null>(null);

export function useAnchor(): AnchorState {
  const state = useContext(AnchorContext);
  if (!state) throw new Error('useAnchor must be used inside AnchorContext');
  return state;
}
