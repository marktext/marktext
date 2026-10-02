/**
 * Per-window agent and terminal processes. Later epics register the real host;
 * until then every window is idle.
 *
 * `cancelTurn` must signal the harness before its first await. Closing a window
 * starts shutdown and destroys the window without waiting for the promise.
 */
export interface WindowAgentHost {
  hasActiveTurn(): boolean
  cancelTurn(): Promise<void>
  disposeHarness(): Promise<void>
  disposePty(): Promise<void>
}

const idleHost: WindowAgentHost = {
  hasActiveTurn: () => false,
  cancelTurn: () => Promise.resolve(),
  disposeHarness: () => Promise.resolve(),
  disposePty: () => Promise.resolve()
}

const hosts = new Map<number, WindowAgentHost>()

export const setWindowAgentHost = (windowId: number, host: WindowAgentHost): void => {
  hosts.set(windowId, host)
}

export const clearWindowAgentHost = (windowId: number): void => {
  hosts.delete(windowId)
}

export const agentHostFor = (windowId: number): WindowAgentHost => hosts.get(windowId) ?? idleHost

/**
 * Cancel the turn, then stop the harness process and every pty of the window.
 * A failed step does not skip the ones after it.
 */
export const shutdownWindowAgent = async(windowId: number): Promise<void> => {
  const host = agentHostFor(windowId)
  const steps = [() => host.cancelTurn(), () => host.disposeHarness(), () => host.disposePty()]
  let failure: unknown = null
  for (const step of steps) {
    try {
      await step()
    } catch (error) {
      failure = error
    }
  }
  if (failure) throw failure
}
