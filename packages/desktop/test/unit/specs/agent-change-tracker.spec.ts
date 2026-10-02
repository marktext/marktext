import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ChangeTracker,
  attachChangeTracker,
  detachChangeTracker,
  recordEditorSave,
  repoRelativePath
} from 'main_renderer/agent/turn/changeTracker'

const dirs: string[] = []
const windows = [41, 42, 99]

afterEach(() => {
  for (const windowId of windows) detachChangeTracker(windowId)
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-changes-'))
  dirs.push(dir)
  return dir
}

const git = (cwd: string, args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })

const initRepo = async(dir: string): Promise<void> => {
  await git(dir, ['init', '-q'])
  await git(dir, ['config', 'user.email', 'tester@example.com'])
  await git(dir, ['config', 'user.name', 'Tester'])
}

const write = (root: string, filePath: string, text: string): void => {
  const full = path.join(root, filePath)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, text)
}

describe('changeTracker', () => {
  it('keeps a path inside the repository and drops one that leaves it', () => {
    const root = tempDir()
    expect(repoRelativePath(root, path.join(root, 'docs/guide.md'))).toBe('docs/guide.md')
    expect(repoRelativePath(root, 'docs/guide.md')).toBe('docs/guide.md')
    expect(repoRelativePath(root, path.join(root, '../outside.md'))).toBeNull()
    expect(repoRelativePath(root, 'docs/../../outside.md')).toBeNull()
  })

  it('reports agent writes and deletions, and skips editor saves and comment files', async() => {
    const root = tempDir()
    await initRepo(root)
    write(root, 'README.md', 'readme\n')
    write(root, 'docs/guide.md', 'before\n')
    write(root, 'gone.md', 'gone\n')
    write(root, 'old.md', 'old\n')
    await git(root, ['add', '--', '.'])
    await git(root, ['commit', '-qm', 'init'])

    const tracker = await ChangeTracker.open(root)
    attachChangeTracker(41, tracker)

    write(root, 'docs/guide.md', 'after\n')
    write(root, 'notes.md', 'human\n')
    write(root, 'agent-new.md', 'agent\n')
    write(root, '.marktext/comments/docs/guide.md.json', '{}\n')
    fs.unlinkSync(path.join(root, 'gone.md'))
    await git(root, ['mv', '--', 'old.md', 'renamed.md'])
    recordEditorSave(41, path.join(root, 'notes.md'))
    tracker.noteAcpPaths([
      path.join(root, 'docs/guide.md'),
      path.join(root, '.marktext/comments/docs/guide.md.json'),
      path.join(root, '../outside.md'),
      '/etc/passwd'
    ])

    expect(await tracker.finish()).toEqual([
      'agent-new.md',
      'docs/guide.md',
      'gone.md',
      'old.md',
      'renamed.md'
    ])
  })

  it('ignores a dirty file until its content changes', async() => {
    const root = tempDir()
    await initRepo(root)
    write(root, 'base.md', 'base\n')
    await git(root, ['add', '--', '.'])
    await git(root, ['commit', '-qm', 'init'])
    write(root, 'dirty.md', 'v1\n')

    const tracker = await ChangeTracker.open(root)
    expect(await tracker.finish()).toEqual([])

    write(root, 'dirty.md', 'v2\n')
    expect(await tracker.finish()).toEqual(['dirty.md'])
  })

  it('keeps an editor save only when ACP named that file, and only for this window', async() => {
    const root = tempDir()
    await initRepo(root)
    write(root, 'base.md', 'base\n')
    await git(root, ['add', '--', '.'])
    await git(root, ['commit', '-qm', 'init'])

    const tracker = await ChangeTracker.open(root)
    attachChangeTracker(41, tracker)
    write(root, 'kept.md', 'agent\n')
    write(root, 'saved.md', 'human\n')
    write(root, 'other.md', 'elsewhere\n')
    write(root, 'both.md', 'named\n')
    recordEditorSave(41, path.join(root, 'saved.md'))
    recordEditorSave(99, path.join(root, 'other.md'))
    recordEditorSave(41, path.join(root, 'both.md'))
    tracker.noteAcpPaths(['both.md'])

    expect(await tracker.finish()).toEqual(['both.md', 'kept.md', 'other.md'])
  })
})
