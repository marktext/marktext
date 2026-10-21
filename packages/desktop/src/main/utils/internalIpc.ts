import { ipcMain } from 'electron'
import type { IpcMainEvent } from 'electron'

// ipcMain.emit forwards payload arguments verbatim; internal channels have no synthetic IpcMainEvent.
export function onInternalChannel<TArgs extends unknown[]>(
  channel: string,
  listener: (...args: TArgs) => void
): void {
  ipcMain.on(channel, listener as unknown as (event: IpcMainEvent, ...args: unknown[]) => void)
}
