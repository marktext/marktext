import { getSessionActions } from './editor'

export const requestWindowCheckpoint = (transactionId?: string): Promise<unknown> => {
  const session = getSessionActions()
  if (!session) return Promise.resolve(false)
  return session.checkpoint(transactionId)
}

export const scheduleWindowCheckpoint = (): void => {
  const session = getSessionActions()
  if (session) session.scheduleCheckpoint()
}
