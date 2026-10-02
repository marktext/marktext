import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  diffHead,
  getRepoRoot,
  getUserName,
  hashFiles,
  statusSnapshot
} from 'main_renderer/agent/repo/gitService'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-git-'))
  dirs.push(dir)
  return dir
}

const git = (cwd: string, args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(error)
      else resolve(stdout)
    })
  })

const initRepo = async(dir: string, userName: string): Promise<void> => {
  await git(dir, ['init', '-q'])
  await git(dir, ['config', 'user.email', 'tester@example.com'])
  await git(dir, ['config', 'user.name', userName])
}

describe('gitService', () => {
  it('resolves the repo root from a subdirectory', async() => {
    const dir = tempDir()
    await initRepo(dir, 'Tester')
    fs.mkdirSync(path.join(dir, 'nested'))
    const fromNested = await getRepoRoot(path.join(dir, 'nested'))
    const fromRoot = await getRepoRoot(dir)
    expect(fromNested).toBe(fromRoot)
    expect(fromNested).toBe(fs.realpathSync(dir))
  })

  it('returns null outside a repository', async() => {
    const dir = tempDir()
    expect(await getRepoRoot(dir)).toBeNull()
  })

  it('returns user.name and falls back to me when it is blank', async() => {
    const named = tempDir()
    await initRepo(named, 'Tester')
    expect(await getUserName(named)).toBe('Tester')

    const blank = tempDir()
    await initRepo(blank, 'Tester')
    // A local empty value overrides a global user.name, so the fallback is observable.
    await git(blank, ['config', 'user.name', ''])
    expect(await getUserName(blank)).toBe('me')
  })

  it('parses status -z with spaces, cyrillic names, and a rename', async() => {
    const dir = tempDir()
    await initRepo(dir, 'Tester')
    fs.writeFileSync(path.join(dir, 'my file.md'), 'hello\n')
    fs.writeFileSync(path.join(dir, 'заметка.md'), 'текст\n')
    await git(dir, ['add', '--', 'my file.md', 'заметка.md'])
    await git(dir, ['commit', '-qm', 'init'])
    await git(dir, ['mv', '--', 'my file.md', 'renamed file.md'])
    fs.writeFileSync(path.join(dir, 'новый файл.md'), 'x\n')

    const entries = await statusSnapshot(dir)
    expect(entries).toEqual([
      { xy: 'R ', path: 'renamed file.md', origPath: 'my file.md' },
      { xy: '??', path: 'новый файл.md', origPath: null }
    ])
  })

  it('hashes files in the requested order', async() => {
    const dir = tempDir()
    await initRepo(dir, 'Tester')
    fs.writeFileSync(path.join(dir, 'заметка.md'), 'текст\n')
    fs.writeFileSync(path.join(dir, 'my file.md'), 'hello\n')
    const expectedNote = (await git(dir, ['hash-object', '--', 'заметка.md'])).trim()
    const expectedFile = (await git(dir, ['hash-object', '--', 'my file.md'])).trim()

    expect(await hashFiles(dir, [])).toEqual([])
    expect(await hashFiles(dir, ['заметка.md', 'my file.md'])).toEqual([
      { path: 'заметка.md', hash: expectedNote },
      { path: 'my file.md', hash: expectedFile }
    ])
  })

  it('diffs a tracked file, an untracked file, and a repo with no commits', async() => {
    const dir = tempDir()
    await initRepo(dir, 'Tester')
    fs.writeFileSync(path.join(dir, 'заметка.md'), 'текст\n')
    await git(dir, ['add', '--', 'заметка.md'])
    await git(dir, ['commit', '-qm', 'init'])
    fs.appendFileSync(path.join(dir, 'заметка.md'), 'правка\n')
    fs.writeFileSync(path.join(dir, 'новый файл.md'), 'черновик\n')

    const tracked = await diffHead(dir, ['заметка.md'])
    expect(tracked).toContain('+правка')

    const untracked = await diffHead(dir, ['новый файл.md'])
    expect(untracked).toContain('черновик')
    expect(untracked).toContain('/dev/null')

    const empty = tempDir()
    await git(empty, ['init', '-q'])
    fs.writeFileSync(path.join(empty, 'a.txt'), 'only\n')
    await git(empty, ['add', '--', 'a.txt'])
    const patch = await diffHead(empty, ['a.txt'])
    expect(patch).toContain('a.txt')
    expect(patch).toContain('+only')
  })

  it('throws git_not_found when git is absent from PATH', async() => {
    const saved = process.env.PATH
    process.env.PATH = tempDir()
    try {
      await expect(getRepoRoot(os.tmpdir())).rejects.toMatchObject({
        name: 'GitCommandError',
        code: 'git_not_found'
      })
    } finally {
      process.env.PATH = saved
    }
  })
})
