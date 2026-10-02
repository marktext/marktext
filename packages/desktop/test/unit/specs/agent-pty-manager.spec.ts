import os from 'os'
import path from 'path'
import fs from 'fs'
import { afterEach, describe, expect, it } from 'vitest'
import { repoRegistry } from 'main_renderer/agent/repo/repoRegistry'
import { PtyManager, PtyManagerError } from 'main_renderer/agent/terminal/ptyManager'

const windowId = 33
const dirs: string[] = []
const managers: PtyManager[] = []

afterEach(async() => {
  for (const manager of managers.splice(0)) await manager.disposeWindow(windowId)
  repoRegistry.release(windowId)
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-pty-'))
  dirs.push(dir)
  return dir
}

const waitFor = async(ready: () => boolean, label: string): Promise<void> => {
  const started = Date.now()
  while (!ready()) {
    if (Date.now() - started > 5_000) throw new Error(label)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

const open = (root: string): { manager: PtyManager, output: string[], exits: { termId: string, code: number | null }[] } => {
  const output: string[] = []
  const exits: { termId: string, code: number | null }[] = []
  const manager = new PtyManager({
    shellPreference: () => '',
    repoRoot: (id) => id === windowId ? root : null,
    newId: () => 'term-1',
    onData: (_windowId, _termId, data) => {
      output.push(data)
    },
    onExit: (_windowId, termId, code) => {
      exits.push({ termId, code })
    }
  })
  managers.push(manager)
  return { manager, output, exits }
}

describe('ptyManager', () => {
  it('rejects create when the window has no repository', () => {
    const manager = new PtyManager({
      shellPreference: () => '',
      repoRoot: () => null,
      newId: () => 'term-1',
      onData: () => undefined,
      onExit: () => undefined
    })
    expect(() => manager.create(windowId, { cols: 80, rows: 24 })).toThrow(PtyManagerError)
  })

  it('prints the repository root, accepts a resize, and exits when killed', async() => {
    const root = tempDir()
    repoRegistry.claim(windowId, { kind: 'repo', root, userName: 'Ada' })
    const { manager, output, exits } = open(root)
    const created = manager.create(windowId, { cols: 80, rows: 24 })
    expect(created.termId).toBe('term-1')

    const command = process.platform === 'win32' ? 'echo $PWD\r' : 'echo $PWD\n'
    manager.input(windowId, created.termId, command)
    await waitFor(() => {
      const text = output.join('')
      return process.platform === 'win32'
        ? text.toLowerCase().includes(root.toLowerCase())
        : text.includes(root)
    }, 'the shell did not print the repository root')

    expect(() => manager.resize(windowId, created.termId, 100, 40)).not.toThrow()
    manager.kill(windowId, created.termId)
    await waitFor(() => exits.some((event) => event.termId === created.termId), 'the pty did not exit')
  })
})
