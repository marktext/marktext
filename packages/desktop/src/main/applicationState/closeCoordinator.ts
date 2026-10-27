import type { SessionState, WindowSnapshot } from '@shared/types/applicationState'
import {
  closeSessionWindow,
  finishSession,
  updateSessionWindow
} from '@shared/applicationState/session'
import { unsavedDocuments } from '@shared/applicationState/startupPlan'
import { createStateId } from './identity'

export interface ClosePorts {
  getSession(): SessionState
  checkpoint(windowId: string, transactionId: string): Promise<WindowSnapshot>
  choose(snapshot: WindowSnapshot, transactionId: string): Promise<'save' | 'discard' | 'cancel'>
  save(snapshot: WindowSnapshot): Promise<'saved' | 'canceled' | 'failed'>
  discard(windowId: string, documentIds: string[]): Promise<void>
  commit(session: SessionState): Promise<void>
  destroy(windowId: string): Promise<void>
}

interface PreparedWindow {
  snapshot: WindowSnapshot
  discarded: Map<string, number>
}

export class CloseCoordinator {
  private pending = false

  constructor(private readonly ports: ClosePorts) {}

  private async capture(windowId: string, transactionId: string): Promise<WindowSnapshot> {
    const snapshot = await this.ports.checkpoint(windowId, transactionId)
    if (snapshot.id !== windowId) throw new Error('Close checkpoint belongs to another window')
    return snapshot
  }

  async closeWindow(windowId: string): Promise<void> {
    if (!windowId) throw new Error('Window identity is required')
    await this.requestClose(windowId)
  }

  quit(): Promise<void> {
    return this.requestClose()
  }

  private async requestClose(windowId?: string): Promise<void> {
    if (this.pending) return
    this.pending = true
    try {
      const initial = this.ports.getSession()
      const windows = structuredClone(
        windowId ? initial.windows.filter((window) => window.id === windowId) : initial.windows
      )
      const matchesMembership = (session: SessionState): boolean =>
        session.windows.length === windows.length &&
        windows.every((window) => session.windows.some((current) => current.id === window.id))
      if (windowId && windows.length === 0) return
      const transactionId = createStateId()
      const prepared: PreparedWindow[] = []
      for (const window of windows) {
        let snapshot = await this.capture(window.id, transactionId)
        let dirty = unsavedDocuments(snapshot)
        const discarded = new Map<string, number>()
        if (dirty.length > 0) {
          const choice = await this.ports.choose(snapshot, transactionId)
          if (choice === 'cancel') return
          if (choice === 'save') {
            const result = await this.ports.save(snapshot)
            if (result !== 'saved') return
            snapshot = await this.capture(window.id, transactionId)
            dirty = unsavedDocuments(snapshot)
            if (dirty.length > 0) return
          } else {
            for (const document of dirty) {
              if (document.content.kind === 'recovery')
                discarded.set(document.id, document.content.contentRevision)
            }
          }
        }
        prepared.push({ snapshot, discarded })
      }
      // Other windows can change while their neighbors' dialogs are being answered.
      for (const entry of prepared) {
        const latest = await this.capture(entry.snapshot.id, transactionId)
        const unexpected = unsavedDocuments(latest).some(
          (document) =>
            document.content.kind === 'recovery' &&
            entry.discarded.get(document.id) !== document.content.contentRevision
        )
        if (unexpected) return
        entry.snapshot = latest
      }
      if (!windowId && !matchesMembership(this.ports.getSession())) return
      for (const entry of prepared) {
        const discarded = unsavedDocuments(entry.snapshot).map((document) => document.id)
        if (discarded.length > 0) {
          await this.ports.discard(entry.snapshot.id, discarded)
          entry.snapshot = await this.capture(entry.snapshot.id, transactionId)
          if (unsavedDocuments(entry.snapshot).length > 0) return
        }
      }
      let final = this.ports.getSession()
      if (!windowId && !matchesMembership(final)) return
      for (const entry of prepared) final = updateSessionWindow(final, entry.snapshot)
      const committed = windowId ? closeSessionWindow(final, windowId) : finishSession(final)
      await this.ports.commit(committed)
      for (const entry of prepared) await this.ports.destroy(entry.snapshot.id)
    } finally {
      this.pending = false
    }
  }
}
