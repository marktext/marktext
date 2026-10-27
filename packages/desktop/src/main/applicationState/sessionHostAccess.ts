import type { WebContents } from 'electron'
import type { SessionHost } from './sessionHost'

const owners = new Map<number, { host: SessionHost; windowId: string }>()
export const sessionRecoveryEnabled = (): boolean => process.env.MARKTEXT_SESSION_RECOVERY === '1'
export const registerManagedOwner = (
  sender: WebContents,
  host: SessionHost,
  windowId: string
): void => {
  owners.set(sender.id, { host, windowId })
  sender.once('destroyed', () => owners.delete(sender.id))
}
export const getManagedOwner = (
  sender: WebContents
): { host: SessionHost; windowId: string } | undefined => owners.get(sender.id)
