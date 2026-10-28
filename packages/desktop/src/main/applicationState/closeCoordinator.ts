import type { SessionState, WindowSnapshot } from '@shared/types/applicationState'
import { unsavedDocuments } from '@shared/applicationState/startupPlan'
import { createStateId } from './identity'

/** Native close operations; persistence must succeed before any window is destroyed. */
export interface ClosePorts {
  getSession(): SessionState
  checkpoint(windowId: string, transactionId: string): Promise<WindowSnapshot>
  choose(snapshot: WindowSnapshot, transactionId: string): Promise<'save' | 'discard' | 'cancel'>
  save(snapshot: WindowSnapshot): Promise<'saved' | 'canceled' | 'failed'>
  // The owner validates every prepared document and applies discards in one serialized commit.
  commit(snapshots: WindowSnapshot[], windowId?: string): Promise<boolean>
  destroy(windowId: string): Promise<void>
}

/** Discard consent applies only to the document revisions seen in the prompt. */
interface PreparedWindow {
  snapshot: WindowSnapshot
  discarded: Map<string, number>
}

export class CloseCoordinator {
  private _pending = false

  constructor(private readonly _ports: ClosePorts) {}

  private async _capture(windowId: string, transactionId: string): Promise<WindowSnapshot> {
    const snapshot = await this._ports.checkpoint(windowId, transactionId)
    if (snapshot.id !== windowId) throw new Error('Close checkpoint belongs to another window')
    return snapshot
  }

  async closeWindow(windowId: string): Promise<void> {
    if (!windowId) throw new Error('Window identity is required')
    await this._requestClose(windowId)
  }

  quit(): Promise<void> {
    return this._requestClose()
  }

  private async _requestClose(windowId?: string): Promise<void> {
    if (this._pending) return
    this._pending = true
    try {
      const initial = this._ports.getSession()
      const windows = structuredClone(
        windowId ? initial.windows.filter((window) => window.id === windowId) : initial.windows
      )
      if (windowId && windows.length === 0) return
      const transactionId = createStateId()
      const prepared: PreparedWindow[] = []
      for (const window of windows) {
        let snapshot = await this._capture(window.id, transactionId)
        let dirty = unsavedDocuments(snapshot)
        const discarded = new Map<string, number>()
        if (dirty.length > 0) {
          const choice = await this._ports.choose(snapshot, transactionId)
          if (choice === 'cancel') return
          if (choice === 'save') {
            const result = await this._ports.save(snapshot)
            if (result !== 'saved') return
            snapshot = await this._capture(window.id, transactionId)
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
        const latest = await this._capture(entry.snapshot.id, transactionId)
        const unexpected = unsavedDocuments(latest).some(
          (document) =>
            document.content.kind === 'recovery' &&
            entry.discarded.get(document.id) !== document.content.contentRevision
        )
        if (unexpected) return
        entry.snapshot = latest
      }
      const committed = await this._ports.commit(
        prepared.map((entry) => entry.snapshot),
        windowId
      )
      if (!committed) return
      for (const entry of prepared) await this._ports.destroy(entry.snapshot.id)
    } finally {
      this._pending = false
    }
  }
}
