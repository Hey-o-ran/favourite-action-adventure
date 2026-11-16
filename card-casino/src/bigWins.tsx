import { createContext, useContext, useRef } from 'react';
import type { WinKind } from './api';

/** A win of at least this many times the bet is a "big win", even when the game did not name it. */
export const BIG_WIN_MULTIPLE = 50;

export interface WinMark {
  /** The game says the round just played was this rare win. It is reported when the round is settled. */
  markWin: (win: WinKind) => void;
}

/** Outside a GameScope (in tests, say) marking a win does nothing. */
export const WinMarkContext = createContext<WinMark>({ markWin() {} });

export const useWinMark = () => useContext(WinMarkContext);

/** What a scope keeps for the round in progress. */
export function useMarkedWin() {
  return useRef<WinKind | null>(null);
}
