// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { confirmAndMoveSidebarItem, prepareSidebarMove } from '../../../src/main/filesystem/sidebarMove'

const { showMessageBox } = vi.hoisted(() => ({ showMessageBox: vi.fn() }))
vi.mock('electron', () => ({ dialog: { showMessageBox } }))
vi.mock('main_renderer/i18n', () => ({ t: (key: string) => key }))

let root: string
let source: string
let targetDirectory: string
const fakeWindow = {} as never

beforeEach(async() => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'marktext-move-')))
  source = path.join(root, 'draft.md')
  targetDirectory = path.join(root, 'notes')
  await fs.outputFile(source, 'original')
  await fs.ensureDir(targetDirectory)
  showMessageBox.mockReset().mockResolvedValue({ response: 0 })
})
afterEach(async() => {
  vi.restoreAllMocks()
  await fs.remove(root)
})

const request = () => ({ rootKey: root, source, targetDirectory })
const operations = () => ({
  root,
  checkAvailable: vi.fn(),
  move: vi.fn(async(_source: string, _destination: string, write: () => Promise<void>) => { await write() })
})

describe('sidebar disk movement', () => {
  it('moves only after confirmation through the coordinated operation', async() => {
    const ops = operations()
    const result = await confirmAndMoveSidebarItem(fakeWindow, request(), ops)
    const destination = path.join(targetDirectory, 'draft.md')
    expect(result).toEqual({ status: 'moved', destination })
    expect(await fs.pathExists(source)).toBe(false)
    expect(await fs.readFile(destination, 'utf8')).toBe('original')
    expect(ops.move).toHaveBeenCalledOnce()
    expect(showMessageBox.mock.calls[0][1]).toMatchObject({ defaultId: 1, cancelId: 1 })
  })

  it('cancels without executing a move', async() => {
    showMessageBox.mockResolvedValue({ response: 1 })
    const ops = operations()
    expect(await confirmAndMoveSidebarItem(fakeWindow, request(), ops)).toEqual({ status: 'canceled' })
    expect(ops.move).not.toHaveBeenCalled()
    expect(await fs.readFile(source, 'utf8')).toBe('original')
  })

  it('moves an entire directory including nested and hidden resources', async() => {
    await fs.remove(source)
    source = path.join(root, 'chapter')
    await fs.outputFile(path.join(source, 'nested', 'a.md'), 'text')
    await fs.outputFile(path.join(source, '.hidden'), 'hidden')
    await fs.outputFile(path.join(source, 'image.bin'), Buffer.from([0, 1, 2]))
    expect((await confirmAndMoveSidebarItem(fakeWindow, request(), operations())).status).toBe('moved')
    expect(await fs.readFile(path.join(targetDirectory, 'chapter', '.hidden'), 'utf8')).toBe('hidden')
    expect(await fs.readFile(path.join(targetDirectory, 'chapter', 'nested', 'a.md'), 'utf8')).toBe('text')
    expect(await fs.readFile(path.join(targetDirectory, 'chapter', 'image.bin'))).toEqual(Buffer.from([0, 1, 2]))
    expect(await fs.pathExists(source)).toBe(false)
  })

  it('rechecks name conflicts after confirmation without overwriting either file', async() => {
    showMessageBox.mockImplementation(async() => {
      await fs.outputFile(path.join(targetDirectory, 'draft.md'), 'existing')
      return { response: 0 }
    })
    expect(await confirmAndMoveSidebarItem(fakeWindow, request(), operations())).toEqual({
      status: 'failed', message: 'sideBar.move.conflict'
    })
    expect(await fs.readFile(source, 'utf8')).toBe('original')
    expect(await fs.readFile(path.join(targetDirectory, 'draft.md'), 'utf8')).toBe('existing')
  })

  it('checks availability again inside the write callback', async() => {
    const ops = operations()
    ops.checkAvailable.mockImplementationOnce(() => {}).mockImplementation(() => {
      throw new Error('open elsewhere')
    })
    expect(await confirmAndMoveSidebarItem(fakeWindow, request(), ops)).toEqual({ status: 'failed', message: 'open elsewhere' })
    expect(await fs.pathExists(source)).toBe(true)
  })

  it('detects a source that disappears while confirmation is open', async() => {
    showMessageBox.mockImplementation(async() => {
      await fs.remove(source)
      return { response: 0 }
    })
    expect(await confirmAndMoveSidebarItem(fakeWindow, request(), operations())).toEqual({ status: 'failed', message: 'sideBar.move.missing' })
    expect(await fs.readdir(targetDirectory)).toEqual([])
  })

  it('does not move a replacement file created while confirmation is open', async() => {
    showMessageBox.mockImplementation(async() => {
      await fs.rename(source, path.join(root, 'original.md'))
      await fs.outputFile(source, 'replacement')
      return { response: 0 }
    })
    expect((await confirmAndMoveSidebarItem(fakeWindow, request(), operations())).status).toBe('failed')
    expect(await fs.readFile(source, 'utf8')).toBe('replacement')
    expect(await fs.readFile(path.join(root, 'original.md'), 'utf8')).toBe('original')
    expect(await fs.readdir(targetDirectory)).toEqual([])
  })

  it('rejects different devices before starting a write', async() => {
    const sourceStat = await fs.lstat(source)
    const targetStat = await fs.lstat(targetDirectory)
    vi.spyOn(fs, 'lstat').mockImplementationOnce(async() => sourceStat)
      .mockImplementationOnce(async() => Object.assign(targetStat, { dev: sourceStat.dev + 1 }))
    const ops = operations()
    expect(await confirmAndMoveSidebarItem(fakeWindow, request(), ops)).toEqual({
      status: 'failed', message: 'sideBar.move.crossDevice'
    })
    expect(ops.move).not.toHaveBeenCalled()
    expect(showMessageBox).not.toHaveBeenCalled()
  })

  it('rejects a directory collision without merging', async() => {
    source = path.join(root, 'chapter')
    await fs.outputFile(path.join(source, 'a.md'), 'source')
    await fs.outputFile(path.join(targetDirectory, 'chapter', 'b.md'), 'target')
    expect((await confirmAndMoveSidebarItem(fakeWindow, request(), operations())).status).toBe('failed')
    expect(await fs.readdir(path.join(targetDirectory, 'chapter'))).toEqual(['b.md'])
    expect(await fs.pathExists(path.join(source, 'a.md'))).toBe(true)
    expect(showMessageBox).not.toHaveBeenCalled()
  })
})

describe('sidebar move path boundaries', () => {
  it('rejects root movement, same parent, outside targets and directory descendants', async() => {
    await expect(prepareSidebarMove(root, { ...request(), source: root })).rejects.toThrow()
    await expect(prepareSidebarMove(root, { ...request(), targetDirectory: root })).rejects.toThrow()
    await expect(prepareSidebarMove(root, { ...request(), targetDirectory: path.dirname(root) })).rejects.toThrow()
    await expect(prepareSidebarMove(root, { ...request(), source: targetDirectory, targetDirectory })).rejects.toThrow()
    await fs.ensureDir(path.join(targetDirectory, 'child'))
    await expect(prepareSidebarMove(root, { ...request(), source: targetDirectory, targetDirectory: path.join(targetDirectory, 'child') })).rejects.toThrow()
  })

  it('rejects symlink nodes and linked ancestors even when their targets are in the root', async() => {
    const link = path.join(root, 'linked')
    await fs.symlink(targetDirectory, link, 'dir')
    await expect(prepareSidebarMove(root, { ...request(), targetDirectory: link })).rejects.toThrow()
    await fs.ensureDir(path.join(targetDirectory, 'nested'))
    await expect(prepareSidebarMove(root, { ...request(), targetDirectory: path.join(link, 'nested') })).rejects.toThrow()
    await fs.symlink(source, path.join(root, 'linked.md'))
    await expect(prepareSidebarMove(root, { ...request(), source: path.join(root, 'linked.md') })).rejects.toThrow()
  })

  it('preserves internal symlinks without moving their targets', async() => {
    source = path.join(root, 'chapter')
    await fs.ensureDir(source)
    await fs.symlink(path.join(root, 'draft.md'), path.join(source, 'reference.md'))
    const result = await confirmAndMoveSidebarItem(fakeWindow, request(), operations())
    expect(result.status).toBe('moved')
    expect((await fs.lstat(path.join(targetDirectory, 'chapter', 'reference.md'))).isSymbolicLink()).toBe(true)
    expect(await fs.readFile(path.join(root, 'draft.md'), 'utf8')).toBe('original')
  })

  it('does not confuse directories that only share a name prefix', async() => {
    source = path.join(root, 'chapter')
    targetDirectory = path.join(root, 'chapter2')
    await fs.ensureDir(source)
    await fs.ensureDir(targetDirectory)
    expect((await prepareSidebarMove(root, request())).destination).toBe(path.join(targetDirectory, 'chapter'))
  })
})
