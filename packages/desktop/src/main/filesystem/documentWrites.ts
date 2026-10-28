interface DocumentWriteState {
  readOnly: boolean
  barriers: number
  epoch: number
  pending: Promise<unknown>
}

/** A lock is acknowledged only after writes accepted before it have settled. */
export class DocumentWriteCoordinator {
  private _states = new Map<string, DocumentWriteState>()

  private _state(owner: number, tabId: string): DocumentWriteState {
    const key = `${owner}:${tabId}`
    let state = this._states.get(key)
    if (!state) {
      state = { readOnly: false, barriers: 0, epoch: 0, pending: Promise.resolve() }
      this._states.set(key, state)
    }
    return state
  }

  capture(owner: number, tabId: string): number | null {
    const state = this._state(owner, tabId)
    return state.readOnly || state.barriers > 0 ? null : state.epoch
  }

  async setReadOnly(owner: number, tabId: string, readOnly: boolean): Promise<void> {
    const state = this._state(owner, tabId)
    state.readOnly = readOnly
    state.epoch++
    await state.pending
  }

  /** Temporary IO barriers must not replace a user's independently changing read-only choice. */
  async withBlockedWrites<T>(
    owner: number,
    tabIds: string[],
    operation: () => Promise<T>
  ): Promise<T> {
    const states = [...new Set(tabIds)].map((id) => this._state(owner, id))
    for (const state of states) {
      state.barriers++
      state.epoch++
    }
    try {
      await Promise.all(states.map((state) => state.pending))
      return await operation()
    } finally {
      for (const state of states) state.barriers--
    }
  }

  async write<T>(
    owner: number,
    tabId: string,
    epoch: number,
    write: () => Promise<T>
  ): Promise<T | undefined> {
    const state = this._state(owner, tabId)
    const accepted = state.pending.then(() => {
      if (state.readOnly || state.barriers > 0 || state.epoch !== epoch) return undefined
      return write()
    })
    state.pending = accepted.catch(() => {})
    return accepted
  }

  forget(owner: number, tabId: string): void {
    const state = this._state(owner, tabId)
    state.readOnly = true
    state.epoch++
  }

  clearOwner(owner: number): void {
    for (const key of this._states.keys()) {
      if (key.startsWith(`${owner}:`)) this._states.delete(key)
    }
  }
}

export const documentWrites = new DocumentWriteCoordinator()
