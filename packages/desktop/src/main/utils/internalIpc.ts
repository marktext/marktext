import { ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'

// Subscribe to an in-process channel dispatched via `ipcMain.emit(channel, ...args)`,
// which forwards the payload args to listeners verbatim — there is no synthetic
// `IpcMainEvent` like the renderer->main path that `ipcMain.on` is typed for. The
// signature adaptation is contained here so callers keep real payload types.
export function onInternalChannel<TArgs extends unknown[]>(
  channel: string,
  listener: (...args: TArgs) => void
): void {
  ipcMain.on(channel, listener as unknown as (event: IpcMainEvent, ...args: unknown[]) => void)
}
