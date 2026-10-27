import type { SaveDocumentResult } from '@shared/types/ipc'

export interface SessionActions {
  captureView(): void
  save(id: string, saveAs?: boolean): Promise<SaveDocumentResult>
  create(markdown: string, selected: boolean): Promise<void>
  close(ids: string[]): Promise<void>
  saveAll(closeTabs: boolean): Promise<void>
}
let actions: SessionActions | null = null
export const getSessionActions = (): SessionActions | null => actions
export const setSessionActions = (value: SessionActions | null): void => {
  actions = value
}
export const isSessionRecoveryEnabled = (): boolean =>
  window.electron?.process?.env?.MARKTEXT_SESSION_RECOVERY !== '0'
