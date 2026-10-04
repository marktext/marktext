import type { HarnessId } from '@shared/types/agent'

/** The turn whose replies this window may append. Later epics publish it for the life of the turn. */
export interface WindowTurn {
  turnId: string
  file: string
  threadIds: readonly string[]
  harness: HarnessId
  model: string
}

const turns = new Map<number, WindowTurn>()

type TurnPresence = (active: boolean) => void

const presence = new Set<TurnPresence>()

/** Settings locks the harness switch while any editor window still has a turn. */
export const onAnyTurnChange = (listener: TurnPresence): (() => void) => {
  presence.add(listener)
  return () => {
    presence.delete(listener)
  }
}

const publishPresence = (before: boolean): void => {
  const active = turns.size > 0
  if (active === before) return
  for (const listener of presence) listener(active)
}

export const anyTurnRunning = (): boolean => turns.size > 0

export const setWindowTurn = (windowId: number, turn: WindowTurn | null): void => {
  const before = turns.size > 0
  if (turn) turns.set(windowId, turn)
  else turns.delete(windowId)
  publishPresence(before)
}

export const windowTurn = (windowId: number): WindowTurn | null => turns.get(windowId) ?? null
