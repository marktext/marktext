import { expect, test } from '@playwright/test'
import { launchElectron } from './helpers'

test('cleanup terminates Electron even when the inspector stops replying', async() => {
  const { app } = await launchElectron([], { preferences: { language: 'en' } })
  const child = app.process()
  app.evaluate = () => new Promise<never>(() => {})
  try {
    await app.close()
    expect(child.signalCode).toBe('SIGKILL')
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
})
