import type { SessionState, WindowSnapshot } from '../types/applicationState'

const activeId = (windows: WindowSnapshot[], preferred: string | null): string | null => {
  if (windows.some((window) => window.id === preferred)) return preferred
  return (
    windows.reduce<WindowSnapshot | null>(
      (latest, window) =>
        !latest || window.lastActivatedAtMs > latest.lastActivatedAtMs ? window : latest,
      null
    )?.id ?? null
  )
}

export const registerSessionWindow = (
  session: SessionState,
  snapshot: WindowSnapshot
): SessionState => ({
  ...session,
  lifecycle: 'running',
  windows: [
    ...session.windows.filter((window) => window.id !== snapshot.id),
    structuredClone(snapshot)
  ],
  activeWindowId: snapshot.id,
  lastWindow: null
})

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
    activeWindowId: activeId(windows, session.activeWindowId),
    lastWindow: windows.length === 0 ? structuredClone(closing) : null
  }
}

export const finishSession = (session: SessionState): SessionState => ({
  ...structuredClone(session),
  lifecycle: 'closed'
})
