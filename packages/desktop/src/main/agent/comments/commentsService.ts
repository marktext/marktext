import { readdir, stat } from 'fs/promises'
import path from 'path'
import { hasMarkdownExtension } from 'common/filesystem/paths'
import {
  COMMENTS_DIR,
  REPLY_MAX_CHARS,
  type CommentsFile,
  type CommentsMutation,
  type HumanAuthor,
  type Message,
  type Thread
} from '@shared/types/comments'
import {
  CommentsStoreError,
  load,
  markdownPathFromStoreFile,
  pathFor,
  save
} from './commentsStore'
import { clearCommentsWrite, noteCommentsWrite } from './commentsWriteMark'
import type { WindowTurn } from './windowTurn'

export class CommentsServiceError extends Error {
  readonly code:
    | 'empty_quote'
    | 'not_human'
    | 'last_human_message'
    | 'not_found'
    | 'turn_thread'
    | 'not_markdown'
    | 'destination_exists'
    | 'not_a_repo'

  constructor(
    code: CommentsServiceError['code'],
    message: string
  ) {
    super(message)
    this.name = 'CommentsServiceError'
    this.code = code
  }
}

export interface CommentsServiceDeps {
  now(): string
  newId(): string
  userName(root: string): Promise<string>
  turnOf(windowId: number): WindowTurn | null
  repoOf(windowId: number): string | null
  onChanged(root: string, file: string): void
}

const isHuman = (message: Message): boolean => message.author.kind === 'human'

const relativePosix = (root: string, absolute: string): string | null => {
  const relative = path.relative(path.resolve(root), path.resolve(absolute))
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
  return relative.split(path.sep).join('/')
}

const writableFile = (result: Awaited<ReturnType<typeof load>>): CommentsFile => {
  if (result.kind === 'parse_error') {
    throw new CommentsStoreError('comments_write_blocked', result.message, result.path)
  }
  return result.file
}

/**
 * The only writer of comment threads. Mutations of one JSON file run in order
 * so two overlapping edits cannot drop each other.
 */
export class CommentsService {
  private readonly tails = new Map<string, Promise<void>>()

  constructor(private readonly deps: CommentsServiceDeps) {}

  apply(windowId: number, root: string, mutation: CommentsMutation): Promise<CommentsFile> {
    switch (mutation.op) {
      case 'createThread':
        return this.createThread(root, mutation.file, mutation.anchor, mutation.firstText)
      case 'addHumanMessage':
        return this.addHumanMessage(root, mutation.threadId, mutation.text)
      case 'editHumanMessage':
        return this.editHumanMessage(root, mutation.messageId, mutation.text)
      case 'deleteHumanMessage':
        return this.deleteHumanMessage(root, mutation.messageId)
      case 'setStatus':
        return this.setStatus(root, mutation.threadId, mutation.status)
      case 'deleteThread':
        return this.deleteThread(root, mutation.threadId)
      case 'appendAgentReply':
        return this.appendAgentReply(windowId, root, mutation.turnId, mutation.threadId, mutation.text)
      case 'moveFile':
        return this.moveFile(root, mutation.oldPath, mutation.newPath)
      default: {
        const unreachable: never = mutation
        return unreachable
      }
    }
  }

  /** After MarkText renames a markdown file, move its comments when it lives in this window's repo. */
  async moveMarkdown(windowId: number, fromAbsolute: string, toAbsolute: string): Promise<void> {
    const root = this.deps.repoOf(windowId)
    if (!root || !hasMarkdownExtension(fromAbsolute)) return
    const oldPath = relativePosix(root, fromAbsolute)
    const newPath = relativePosix(root, toAbsolute)
    if (!oldPath || !newPath || oldPath === newPath) return
    await this.moveFile(root, oldPath, newPath)
  }

  private enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    const run = previous.then(job, job)
    this.tails.set(key, run.then(() => undefined, () => undefined))
    return run
  }

  private exclusive<T>(keys: readonly string[], job: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(keys)].sort()
    const step = (index: number): Promise<T> => {
      if (index === ordered.length) return job()
      return this.enqueue(ordered[index], () => step(index + 1))
    }
    return step(0)
  }

  private async write(root: string, file: CommentsFile): Promise<CommentsFile> {
    const filePath = pathFor(root, file.file)
    noteCommentsWrite(filePath)
    try {
      await save(root, file)
    } catch (error) {
      clearCommentsWrite(filePath)
      throw error
    }
    this.deps.onChanged(root, file.file)
    const stored = await load(root, file.file)
    return writableFile(stored)
  }

  private async createThread(
    root: string,
    file: string,
    anchor: Thread['anchor'],
    firstText: string
  ): Promise<CommentsFile> {
    if (anchor.quote.trim().length === 0) {
      throw new CommentsServiceError('empty_quote', 'a thread needs a non-empty quote')
    }
    const filePath = pathFor(root, file)
    return this.exclusive([filePath], async() => {
      const current = writableFile(await load(root, file))
      const createdAt = this.deps.now()
      const author = await this.human(root)
      const thread: Thread = {
        id: this.deps.newId(),
        status: 'open',
        createdAt,
        closedAt: null,
        anchor,
        messages: [
          {
            id: this.deps.newId(),
            author,
            text: firstText,
            createdAt,
            editedAt: null
          }
        ]
      }
      return this.write(root, { ...current, threads: [...current.threads, thread] })
    })
  }

  private async addHumanMessage(root: string, threadId: string, text: string): Promise<CommentsFile> {
    const file = await this.fileOfThread(root, threadId)
    return this.exclusive([pathFor(root, file)], async() => {
      const current = writableFile(await load(root, file))
      if (!current.threads.some((thread) => thread.id === threadId)) {
        throw new CommentsServiceError('not_found', `thread ${threadId} was not found`)
      }
      const author = await this.human(root)
      const createdAt = this.deps.now()
      return this.write(root, {
        ...current,
        threads: current.threads.map((thread) => thread.id === threadId
          ? {
            ...thread,
            messages: [...thread.messages, {
              id: this.deps.newId(),
              author,
              text,
              createdAt,
              editedAt: null
            }]
          }
          : thread)
      })
    })
  }

  private async editHumanMessage(root: string, messageId: string, text: string): Promise<CommentsFile> {
    const located = await this.fileOfMessage(root, messageId)
    return this.exclusive([pathFor(root, located.file)], async() => {
      const current = writableFile(await load(root, located.file))
      const message = this.messageIn(current, messageId)
      if (!isHuman(message)) {
        throw new CommentsServiceError('not_human', 'an agent reply cannot be edited')
      }
      const editedAt = this.deps.now()
      return this.write(root, {
        ...current,
        threads: current.threads.map((thread) => ({
          ...thread,
          messages: thread.messages.map((item) => item.id === messageId && isHuman(item)
            ? { ...item, text, editedAt }
            : item)
        }))
      })
    })
  }

  private async deleteHumanMessage(root: string, messageId: string): Promise<CommentsFile> {
    const located = await this.fileOfMessage(root, messageId)
    return this.exclusive([pathFor(root, located.file)], async() => {
      const current = writableFile(await load(root, located.file))
      const thread = current.threads.find((item) => item.messages.some((message) => message.id === messageId))
      const message = thread?.messages.find((item) => item.id === messageId)
      if (!thread || !message) {
        throw new CommentsServiceError('not_found', `message ${messageId} was not found`)
      }
      if (!isHuman(message)) {
        throw new CommentsServiceError('not_human', 'an agent reply cannot be deleted')
      }
      const humanCount = thread.messages.filter(isHuman).length
      if (humanCount <= 1) {
        throw new CommentsServiceError('last_human_message', 'the last human reply is removed with the thread')
      }
      return this.write(root, {
        ...current,
        threads: current.threads.map((item) => item.id === thread.id
          ? { ...item, messages: item.messages.filter((entry) => entry.id !== messageId) }
          : item)
      })
    })
  }

  private async setStatus(root: string, threadId: string, status: Thread['status']): Promise<CommentsFile> {
    const file = await this.fileOfThread(root, threadId)
    return this.exclusive([pathFor(root, file)], async() => {
      const current = writableFile(await load(root, file))
      if (!current.threads.some((thread) => thread.id === threadId)) {
        throw new CommentsServiceError('not_found', `thread ${threadId} was not found`)
      }
      const now = this.deps.now()
      return this.write(root, {
        ...current,
        threads: current.threads.map((thread) => {
          if (thread.id !== threadId) return thread
          if (status === 'closed') {
            return { ...thread, status, closedAt: thread.status === 'closed' ? thread.closedAt : now }
          }
          return { ...thread, status, closedAt: null }
        })
      })
    })
  }

  private async deleteThread(root: string, threadId: string): Promise<CommentsFile> {
    const file = await this.fileOfThread(root, threadId)
    return this.exclusive([pathFor(root, file)], async() => {
      const current = writableFile(await load(root, file))
      if (!current.threads.some((thread) => thread.id === threadId)) {
        throw new CommentsServiceError('not_found', `thread ${threadId} was not found`)
      }
      return this.write(root, {
        ...current,
        threads: current.threads.filter((thread) => thread.id !== threadId)
      })
    })
  }

  private async appendAgentReply(
    windowId: number,
    root: string,
    turnId: string,
    threadId: string,
    text: string
  ): Promise<CommentsFile> {
    const turn = this.deps.turnOf(windowId)
    if (!turn || turn.turnId !== turnId || turn.file.length === 0 || !turn.threadIds.includes(threadId)) {
      throw new CommentsServiceError('turn_thread', 'the reply is not part of the current turn')
    }
    const filePath = pathFor(root, turn.file)
    return this.exclusive([filePath], async() => {
      const current = writableFile(await load(root, turn.file))
      const thread = current.threads.find((item) => item.id === threadId)
      if (!thread) throw new CommentsServiceError('not_found', `thread ${threadId} was not found`)
      const createdAt = this.deps.now()
      return this.write(root, {
        ...current,
        threads: current.threads.map((item) => item.id === threadId
          ? {
            ...item,
            messages: [...item.messages, {
              id: this.deps.newId(),
              author: { kind: 'agent' as const, harness: turn.harness, model: turn.model },
              text: text.slice(0, REPLY_MAX_CHARS),
              createdAt,
              turnId
            }]
          }
          : item)
      })
    })
  }

  private async moveFile(root: string, oldPath: string, newPath: string): Promise<CommentsFile> {
    if (!hasMarkdownExtension(oldPath)) {
      throw new CommentsServiceError('not_markdown', 'comments move with a markdown file')
    }
    if (oldPath === newPath) return writableFile(await load(root, oldPath))
    const oldFile = pathFor(root, oldPath)
    const newFile = pathFor(root, newPath)
    return this.exclusive([oldFile, newFile], async() => {
      const current = await load(root, oldPath)
      if (current.kind === 'parse_error') {
        throw new CommentsStoreError('comments_write_blocked', current.message, current.path)
      }
      if (current.file.threads.length === 0) {
        return { ...current.file, file: newPath }
      }
      try {
        await stat(newFile)
        const destination = await load(root, newPath)
        if (destination.kind === 'parse_error') {
          throw new CommentsStoreError('comments_write_blocked', destination.message, destination.path)
        }
        throw new CommentsServiceError('destination_exists', 'the destination already has comments')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const moved = await this.write(root, { ...current.file, file: newPath })
      await this.write(root, { ...current.file, threads: [] })
      return moved
    })
  }

  private async human(root: string): Promise<HumanAuthor> {
    return { kind: 'human', name: await this.deps.userName(root) }
  }

  private messageIn(file: CommentsFile, messageId: string): Message {
    for (const thread of file.threads) {
      const message = thread.messages.find((item) => item.id === messageId)
      if (message) return message
    }
    throw new CommentsServiceError('not_found', `message ${messageId} was not found`)
  }

  private async fileOfThread(root: string, threadId: string): Promise<string> {
    const found = await this.findCommentsFile(root, (file) => file.threads.some((thread) => thread.id === threadId))
    if (!found) throw new CommentsServiceError('not_found', `thread ${threadId} was not found`)
    return found
  }

  private async fileOfMessage(root: string, messageId: string): Promise<{ file: string }> {
    const found = await this.findCommentsFile(root, (file) => file.threads.some((thread) =>
      thread.messages.some((message) => message.id === messageId)))
    if (!found) throw new CommentsServiceError('not_found', `message ${messageId} was not found`)
    return { file: found }
  }

  private async findCommentsFile(
    root: string,
    match: (file: CommentsFile) => boolean
  ): Promise<string | null> {
    const directory = path.resolve(root, COMMENTS_DIR)
    return walkComments(directory, async(absolute) => {
      const mdPath = markdownPathFromStoreFile(absolute)
      if (!mdPath) return null
      const result = await load(root, mdPath)
      if (result.kind !== 'ok' || !match(result.file)) return null
      return mdPath
    })
  }
}

const walkComments = async(
  directory: string,
  visit: (absolute: string) => Promise<string | null>
): Promise<string | null> => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = await walkComments(absolute, visit)
      if (nested) return nested
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      const found = await visit(absolute)
      if (found) return found
    }
  }
  return null
}

let bound: CommentsService | null = null

export const bindCommentsService = (deps: CommentsServiceDeps): CommentsService => {
  bound = new CommentsService(deps)
  return bound
}

export const commentsService = (): CommentsService => {
  if (!bound) throw new CommentsServiceError('not_a_repo', 'comments service is not ready')
  return bound
}

export const moveMarkdownComments = (
  windowId: number,
  fromAbsolute: string,
  toAbsolute: string
): Promise<void> => {
  if (!bound) return Promise.resolve()
  return bound.moveMarkdown(windowId, fromAbsolute, toAbsolute)
}
