import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { serializeCommentsFile, type CommentsFile, type Thread } from '@shared/types/comments'
import {
  CommentsStoreError,
  load,
  pathFor,
  save
} from 'main_renderer/agent/comments/commentsStore'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-comments-'))
  dirs.push(dir)
  return dir
}

const thread = (createdAt: string, id: string): Thread => ({
  id,
  status: 'open',
  createdAt,
  closedAt: null,
  anchor: {
    quote: 'цитата',
    prefix: 'до ',
    suffix: ' после',
    blockHint: { type: 'paragraph', index: 1 }
  },
  messages: [
    {
      id: `${id}-msg`,
      author: { kind: 'human', name: 'Ada' },
      text: 'заметка',
      createdAt,
      editedAt: null
    }
  ]
})

const comments = (file: string, threads: Thread[]): CommentsFile => ({
  version: 1,
  file,
  threads
})

describe('commentsStore', () => {
  it('maps a markdown path onto .marktext/comments and rejects paths that leave the repo', () => {
    const root = tempDir()
    expect(pathFor(root, 'docs/guide.md')).toBe(
      path.resolve(root, '.marktext/comments/docs/guide.md.json')
    )
    expect(pathFor(root, 'заметка.md')).toBe(
      path.resolve(root, '.marktext/comments/заметка.md.json')
    )

    for (const mdPath of ['../secret.md', '/etc/passwd.md', 'docs/../../outside.md', 'C:/secret.md', 'docs\\guide.md']) {
      expect(() => pathFor(root, mdPath)).toThrow(CommentsStoreError)
    }
  })

  it('loads a missing file as an empty comments file', async() => {
    const root = tempDir()
    await expect(load(root, 'docs/missing.md')).resolves.toEqual({
      kind: 'ok',
      file: { version: 1, file: 'docs/missing.md', threads: [] }
    })
    expect(fs.existsSync(path.join(root, '.marktext'))).toBe(false)
  })

  it('writes the serializer bytes and round-trips them', async() => {
    const root = tempDir()
    const file = comments('docs/guide.md', [
      thread('2026-10-02T12:00:00.000Z', 'later'),
      thread('2026-10-02T11:00:00.000Z', 'earlier')
    ])
    await save(root, file)

    const filePath = pathFor(root, 'docs/guide.md')
    expect(fs.readFileSync(filePath, 'utf8')).toBe(serializeCommentsFile(file))
    expect(fs.readdirSync(path.dirname(filePath)).some((name) => name.endsWith('.tmp'))).toBe(false)

    const loaded = await load(root, 'docs/guide.md')
    expect(loaded.kind).toBe('ok')
    if (loaded.kind === 'ok') {
      expect(loaded.file.threads.map((item) => item.id)).toEqual(['earlier', 'later'])
    }
  })

  it('reports invalid JSON and conflict markers as parse_error and does not overwrite them', async() => {
    const root = tempDir()
    const filePath = pathFor(root, 'docs/guide.md')
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    const broken = '<<<<<<< HEAD\n{ not json\n'
    fs.writeFileSync(filePath, broken)

    const loaded = await load(root, 'docs/guide.md')
    expect(loaded).toEqual({ kind: 'parse_error', path: filePath, message: 'conflict marker' })

    await expect(save(root, comments('docs/guide.md', [thread('2026-10-02T11:00:00.000Z', 't')]))).rejects.toMatchObject({
      code: 'comments_write_blocked',
      filePath
    })
    expect(fs.readFileSync(filePath, 'utf8')).toBe(broken)

    fs.writeFileSync(filePath, '{')
    const invalid = await load(root, 'docs/guide.md')
    expect(invalid.kind).toBe('parse_error')
    await expect(save(root, comments('docs/guide.md', []))).rejects.toMatchObject({
      code: 'comments_write_blocked'
    })
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{')
  })

  it('removes an empty thread list and the directories that become empty', async() => {
    const root = tempDir()
    await save(root, comments('docs/sub/a.md', [thread('2026-10-02T11:00:00.000Z', 'keep')]))
    await save(root, comments('docs/sub/b.md', [thread('2026-10-02T11:00:00.000Z', 'drop')]))
    await save(root, comments('docs/sub/b.md', []))

    expect(fs.existsSync(pathFor(root, 'docs/sub/b.md'))).toBe(false)
    expect(fs.existsSync(pathFor(root, 'docs/sub/a.md'))).toBe(true)

    await save(root, comments('docs/sub/a.md', []))
    expect(fs.existsSync(path.join(root, '.marktext/comments/docs'))).toBe(false)
    expect(fs.existsSync(path.join(root, '.marktext/comments'))).toBe(true)
  })
})
