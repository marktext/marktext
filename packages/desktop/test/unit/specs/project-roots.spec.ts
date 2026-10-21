import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectRoots, containsPath } from 'main_renderer/windows/projectRoots'
import { readBufferedRoots } from '@shared/types/project'

describe('window project roots (#2222)', () => {
  let directory: string
  let a: string
  let b: string
  const effects = { publish: vi.fn(), watch: vi.fn(), unwatch: vi.fn(), remember: vi.fn() }
  let project: ProjectRoots

  beforeEach(() => {
    vi.clearAllMocks()
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-roots-'))
    a = path.join(directory, 'a')
    b = path.join(directory, 'b')
    fs.mkdirSync(a)
    fs.mkdirSync(b)
    a = fs.realpathSync(a)
    b = fs.realpathSync(b)
    project = new ProjectRoots(effects)
  })

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }))

  it('appends independently and publishes the root before starting its watcher', () => {
    project.add(a)
    project.add(b)
    expect(project.roots.map((root) => root.pathname)).toEqual([a, b])
    expect(effects.unwatch).not.toHaveBeenCalled()
    expect(effects.publish.mock.invocationCallOrder[0]).toBeLessThan(
      effects.watch.mock.invocationCallOrder[0]
    )
    const otherWindow = new ProjectRoots({ ...effects })
    otherWindow.add(b)
    expect(project.roots).toHaveLength(2)
  })

  it('deduplicates aliases and rejects nested roots without changing the list', () => {
    project.add(a)
    const alias = path.join(directory, 'alias')
    fs.symlinkSync(a, alias, process.platform === 'win32' ? 'junction' : 'dir')
    project.add(alias)
    expect(project.roots).toHaveLength(1)
    expect(effects.publish.mock.lastCall?.[0].reason).toBe('reveal')
    expect(() => project.add(directory)).toThrow('overlap')
    expect(project.roots.map((root) => root.pathname)).toEqual([a])
    expect(containsPath(a, `${a}-sibling`)).toBe(false)
  })

  it('validates replacement before unloading the existing roots', () => {
    project.add(a)
    project.add(b)
    expect(() => project.add(path.join(directory, 'missing'), true)).toThrow()
    expect(project.roots).toHaveLength(2)
    expect(effects.unwatch).not.toHaveBeenCalled()
    project.add(b, true)
    expect(project.roots.map((root) => root.pathname)).toEqual([b])
    expect(effects.unwatch).toHaveBeenCalledTimes(2)
  })

  it('removes only its target and ignores a removed watcher after readding the same path', () => {
    project.add(a)
    project.add(b)
    const old = { ...project.roots[0] }
    expect(project.remove(old.key)).toBe(true)
    expect(project.roots.map((root) => root.pathname)).toEqual([b])
    expect(effects.unwatch).toHaveBeenCalledWith(expect.objectContaining({ pathname: a }))
    project.add(a)
    project.setStatus(old.key, old.watchToken, 'unavailable', 'stale')
    expect(project.roots[1].status).toBe('loading')
    expect(project.roots[1].watchToken).not.toBe(old.watchToken)
  })

  it('restores unavailable roots without remembering them and starts listeners only after the handshake', () => {
    const missing = path.join(directory, 'missing')
    project.restore([
      { pathname: a, collapsedPaths: [''] },
      { pathname: missing, collapsedPaths: [] }
    ])
    expect(project.roots.map((root) => root.status)).toEqual(['loading', 'unavailable'])
    expect(effects.watch).not.toHaveBeenCalled()
    expect(effects.remember).not.toHaveBeenCalled()
    project.startRestored()
    expect(effects.watch).toHaveBeenCalledTimes(1)
    fs.mkdirSync(missing)
    project.retry(project.roots[1].key)
    expect(project.roots[1].status).toBe('loading')
    expect(effects.watch).toHaveBeenCalledTimes(2)
  })

  it('keeps a failed watcher removable instead of leaving the root loading forever', () => {
    effects.watch.mockImplementationOnce(() => {
      throw new Error('watch failed')
    })
    project.add(a)
    expect(project.roots[0].status).toBe('unavailable')
    expect(project.remove(project.roots[0].key)).toBe(true)
    expect(project.roots).toHaveLength(0)
  })

  it('migrates single-root state and rejects malformed buffered entries', () => {
    expect(readBufferedRoots({ rootDirectory: a })).toEqual([{ pathname: a, collapsedPaths: [] }])
    expect(readBufferedRoots({ roots: [null, { pathname: b, collapsedPaths: ['', 3] }] })).toEqual([
      { pathname: b, collapsedPaths: [''] }
    ])
    expect(readBufferedRoots({ roots: [], rootDirectory: a })).toEqual([])
  })
})
