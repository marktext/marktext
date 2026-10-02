const waiters = new Map<string, (answer: string | 'cancelled') => void>()

/** Registered before the renderer is told, so a synchronous answer is not lost. */
export const waitForPermissionAnswer = (requestId: string): Promise<string | 'cancelled'> =>
  new Promise((resolve) => {
    waiters.set(requestId, resolve)
  })

export const answerPermission = (requestId: string, optionId: string | 'cancelled'): void => {
  const resolve = waiters.get(requestId)
  if (!resolve) return
  waiters.delete(requestId)
  resolve(optionId)
}
