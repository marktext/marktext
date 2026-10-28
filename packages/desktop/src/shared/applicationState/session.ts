import type { SessionState, WindowSnapshot } from '../types/applicationState'

export const getActiveSessionWindow = (
  windows: readonly WindowSnapshot[],
  preferred: string | null
): WindowSnapshot | null => {
  return (
    windows.find((window) => window.id === preferred) ??
    windows.reduce<WindowSnapshot | null>(
      (latest, window) =>
        !latest || window.lastActivatedAtMs > latest.lastActivatedAtMs ? window : latest,
      null
    )
  )
}

export const updateSessionWindow = (
  session: SessionState,
  snapshot: WindowSnapshot
): SessionState => ({
  ...session,
  windows: session.windows.map((window) =>
    window.id === snapshot.id ? structuredClone(snapshot) : window
  )
})

export const activateSessionWindow = (
  session: SessionState,
  id: string,
  nowMs: number
): SessionState => {
  if (!session.windows.some((window) => window.id === id)) return session
  return {
    ...session,
    activeWindowId: id,
    windows: session.windows.map((window) =>
      window.id === id ? { ...window, lastActivatedAtMs: nowMs } : window
    )
  }
}

export const closeSessionWindow = (session: SessionState, id: string): SessionState => {
  const closing = session.windows.find((window) => window.id === id)
  if (!closing) return session
  const windows = session.windows.filter((window) => window.id !== id)
  return {
    ...session,
    windows,
    activeWindowId: getActiveSessionWindow(windows, session.activeWindowId)?.id ?? null,
    lastWindow: windows.length === 0 ? structuredClone(closing) : null
  }
}

export const finishSession = (session: SessionState): SessionState => ({
  ...structuredClone(session),
  lifecycle: 'closed'
})
