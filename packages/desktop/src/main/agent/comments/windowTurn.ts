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

export const setWindowTurn = (windowId: number, turn: WindowTurn | null): void => {
  if (turn) turns.set(windowId, turn)
  else turns.delete(windowId)
}

export const windowTurn = (windowId: number): WindowTurn | null => turns.get(windowId) ?? null
