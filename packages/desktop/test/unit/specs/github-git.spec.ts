import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import git from 'isomorphic-git'
import {
  listChanges,
  stage,
  unstage,
  commit,
  detectRepo,
  hasLfsPatterns,
  resolveAndMerge,
  sync,
  withRepoQueue,
  toGithubHttpsUrl
} from 'main_renderer/github/git'

describe('github/git toGithubHttpsUrl', () => {
  it('normalizes https, scp, and ssh github origins to a canonical https url', () => {
    const https = 'https://github.com/octocat/hello.git'
    expect(toGithubHttpsUrl('https://github.com/octocat/hello.git')).toBe(https)
    expect(toGithubHttpsUrl('https://github.com/octocat/hello')).toBe(https)
    expect(toGithubHttpsUrl('git@github.com:octocat/hello.git')).toBe(https)
    expect(toGithubHttpsUrl('ssh://git@github.com/octocat/hello.git')).toBe(https)
  })

  it('returns null for non-github and malformed origins', () => {
    expect(toGithubHttpsUrl('https://gitlab.com/foo/bar.git')).toBeNull()
    expect(toGithubHttpsUrl('https://github.com.evil.com/foo/bar.git')).toBeNull()
    expect(toGithubHttpsUrl('https://github.com/only-one-segment')).toBeNull()
    expect(toGithubHttpsUrl('not a url')).toBeNull()
  })
})

let dir: string

const initRepo = async(): Promise<void> => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-git-'))
  await git.init({ fs, dir, defaultBranch: 'main' })
  fs.writeFileSync(path.join(dir, 'a.md'), '# hello\n')
  await git.add({ fs, dir, filepath: 'a.md' })
  await git.commit({
    fs,
    dir,
    message: 'init',
    author: { name: 'Test', email: 'test@example.com' }
  })
}

describe('github/git local ops', () => {
  beforeEach(initRepo)
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('listChanges reports modified and untracked files', async() => {
    fs.writeFileSync(path.join(dir, 'a.md'), '# hello world\n')
    fs.writeFileSync(path.join(dir, 'b.md'), '# new\n')
    const changes = await listChanges(dir)
    const byPath = Object.fromEntries(changes.map((c) => [c.filepath, c]))
    expect(byPath['a.md'].status).toBe('modified')
    expect(byPath['a.md'].staged).toBe(false)
    expect(byPath['b.md'].status).toBe('untracked')
  })

  it('listChanges reports a deleted tracked file', async() => {
    fs.rmSync(path.join(dir, 'a.md'))
    const changes = await listChanges(dir)
    const a = changes.find((c) => c.filepath === 'a.md')
    expect(a?.status).toBe('deleted')
  })

  it('listChanges marks staged additions', async() => {
    fs.writeFileSync(path.join(dir, 'b.md'), '# new\n')
    await git.add({ fs, dir, filepath: 'b.md' })
    const b = (await listChanges(dir)).find((c) => c.filepath === 'b.md')
    expect(b?.status).toBe('added')
    expect(b?.staged).toBe(true)
  })

  it('stage then commit clears the change list', async() => {
    fs.writeFileSync(path.join(dir, 'b.md'), '# new\n')
    await stage(dir, ['b.md'])
    const staged = (await listChanges(dir)).find((c) => c.filepath === 'b.md')
    expect(staged?.staged).toBe(true)
    await commit(dir, 'add b', { name: 'Test', email: 'test@example.com' })
    expect(await listChanges(dir)).toHaveLength(0)
  })

  it('stage removes a deleted file from the index', async() => {
    fs.rmSync(path.join(dir, 'a.md'))
    await stage(dir, ['a.md'])
    const a = (await listChanges(dir)).find((c) => c.filepath === 'a.md')
    expect(a?.staged).toBe(true)
  })

  it('unstage reverts a staged file back to unstaged', async() => {
    fs.writeFileSync(path.join(dir, 'a.md'), '# changed\n')
    await stage(dir, ['a.md'])
    expect((await listChanges(dir)).find((c) => c.filepath === 'a.md')?.staged).toBe(true)
    await unstage(dir, ['a.md'])
    const a = (await listChanges(dir)).find((c) => c.filepath === 'a.md')
    expect(a?.staged).toBe(false)
    expect(a?.status).toBe('modified')
  })

  it('detectRepo identifies a github origin and rewrites SSH to HTTPS', async() => {
    await git.addRemote({ fs, dir, remote: 'origin', url: 'git@github.com:octocat/hello.git' })
    expect(await detectRepo(dir)).toEqual({
      isRepo: true,
      remoteUrl: 'git@github.com:octocat/hello.git',
      httpsUrl: 'https://github.com/octocat/hello.git'
    })
  })

  it('detectRepo accepts an ssh:// github origin', async() => {
    await git.addRemote({ fs, dir, remote: 'origin', url: 'ssh://git@github.com/octocat/hello.git' })
    expect(await detectRepo(dir)).toEqual({
      isRepo: true,
      remoteUrl: 'ssh://git@github.com/octocat/hello.git',
      httpsUrl: 'https://github.com/octocat/hello.git'
    })
  })

  it('commit refuses when nothing is staged (guards empty duplicate commits)', async() => {
    await expect(
      commit(dir, 'empty', { name: 'Test', email: 'test@example.com' })
    ).rejects.toThrow(/nothing to commit/i)
  })

  it('detectRepo keeps an https github origin as-is', async() => {
    await git.addRemote({ fs, dir, remote: 'origin', url: 'https://github.com/octocat/hello.git' })
    expect(await detectRepo(dir)).toEqual({
      isRepo: true,
      remoteUrl: 'https://github.com/octocat/hello.git',
      httpsUrl: 'https://github.com/octocat/hello.git'
    })
  })

  it('detectRepo returns isRepo:false for a non-github origin', async() => {
    await git.addRemote({ fs, dir, remote: 'origin', url: 'https://gitlab.com/foo/bar.git' })
    expect(await detectRepo(dir)).toEqual({ isRepo: false })
  })

  it('detectRepo returns isRepo:false when there is no origin remote', async() => {
    expect(await detectRepo(dir)).toEqual({ isRepo: false })
  })

  it('detectRepo returns isRepo:false for a non-git directory', async() => {
    expect(await detectRepo(os.tmpdir())).toEqual({ isRepo: false })
  })

  it('hasLfsPatterns detects filter=lfs in .gitattributes', async() => {
    expect(await hasLfsPatterns(dir)).toBe(false)
    fs.writeFileSync(
      path.join(dir, '.gitattributes'),
      '*.png filter=lfs diff=lfs merge=lfs -text\n'
    )
    expect(await hasLfsPatterns(dir)).toBe(true)
  })
})

// Build a diverged remote tip on refs/remotes/origin/main so the merge logic
// can be exercised without a network transport (isomorphic-git has no
// file:// remote).
const advanceRemote = async(contents: string, message: string): Promise<string> => {
  const initOid = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  await git.writeRef({ fs, dir, ref: 'refs/heads/tmp', value: initOid, force: true })
  await git.checkout({ fs, dir, ref: 'tmp', force: true })
  fs.writeFileSync(path.join(dir, 'a.md'), contents)
  await git.add({ fs, dir, filepath: 'a.md' })
  const oid = await git.commit({
    fs,
    dir,
    message,
    author: { name: 'R', email: 'r@example.com' }
  })
  await git.writeRef({ fs, dir, ref: 'refs/remotes/origin/main', value: oid, force: true })
  await git.checkout({ fs, dir, ref: 'main', force: true })
  return oid
}

describe('github/git resolveAndMerge', () => {
  beforeEach(initRepo)
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('reports no divergence when the remote ref matches local', async() => {
    const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    await git.writeRef({ fs, dir, ref: 'refs/remotes/origin/main', value: head, force: true })
    const res = await resolveAndMerge(dir, 'main', { name: 'M', email: 'm@example.com' })
    expect(res).toEqual({ conflict: false, dirty: false, files: [], ahead: 0, behind: 0 })
  })

  it('fast-forwards when local is strictly behind', async() => {
    const remoteOid = await advanceRemote('# hello\nmore\n', 'remote change')
    const res = await resolveAndMerge(dir, 'main', { name: 'M', email: 'm@example.com' })
    expect(res.conflict).toBe(false)
    expect(res.behind).toBe(1)
    const head = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    expect(head).toBe(remoteOid)
  })

  it('reports conflict without mutating the working tree', async() => {
    // Capture the shared ancestor before diverging.
    const initOid = await git.resolveRef({ fs, dir, ref: 'HEAD' })
    // Local edits a.md one way...
    fs.writeFileSync(path.join(dir, 'a.md'), '# local edit\n')
    await git.add({ fs, dir, filepath: 'a.md' })
    await git.commit({
      fs,
      dir,
      message: 'local',
      author: { name: 'L', email: 'l@example.com' }
    })
    // ...origin edits the same line differently, branching from init.
    await git.writeRef({ fs, dir, ref: 'refs/heads/tmp', value: initOid, force: true })
    await git.checkout({ fs, dir, ref: 'tmp', force: true })
    fs.writeFileSync(path.join(dir, 'a.md'), '# remote edit\n')
    await git.add({ fs, dir, filepath: 'a.md' })
    const remoteOid = await git.commit({
      fs,
      dir,
      message: 'remote',
      author: { name: 'R', email: 'r@example.com' }
    })
    await git.writeRef({ fs, dir, ref: 'refs/remotes/origin/main', value: remoteOid, force: true })
    await git.checkout({ fs, dir, ref: 'main', force: true })

    const before = fs.readFileSync(path.join(dir, 'a.md'), 'utf8')
    const res = await resolveAndMerge(dir, 'main', { name: 'M', email: 'm@example.com' })
    expect(res.conflict).toBe(true)
    expect(res.files).toContain('a.md')
    // Working tree unchanged — no conflict markers written.
    expect(fs.readFileSync(path.join(dir, 'a.md'), 'utf8')).toBe(before)
  })
})

describe('github/git sync guard', () => {
  beforeEach(initRepo)
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('sync refuses a dirty working tree before touching the network', async() => {
    fs.writeFileSync(path.join(dir, 'a.md'), '# uncommitted local edit\n')
    // No fetch mock needed: the dirty guard must return before any network I/O.
    const res = await sync(dir, async() => 'tok', { name: 'M', email: 'm@example.com' })
    expect(res.dirty).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'a.md'), 'utf8')).toBe('# uncommitted local edit\n')
  })
})

describe('github/git withRepoQueue', () => {
  it('serializes operations on the same repo path', async() => {
    const order: number[] = []
    const slow = withRepoQueue('/repo', async() => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push(1)
    })
    const fast = withRepoQueue('/repo', async() => {
      order.push(2)
    })
    await Promise.all([slow, fast])
    expect(order).toEqual([1, 2])
  })

  it('keeps the queue alive after a failed operation', async() => {
    await expect(
      withRepoQueue('/repo2', async() => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(await withRepoQueue('/repo2', async() => 'ok')).toBe('ok')
  })

  it('runs operations on different repos independently', async() => {
    const order: string[] = []
    const a = withRepoQueue('/repoA', async() => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push('a')
    })
    const b = withRepoQueue('/repoB', async() => {
      order.push('b')
    })
    await Promise.all([a, b])
    // b's repo is independent, so it finishes before the slow a.
    expect(order).toEqual(['b', 'a'])
  })
})
