import { mkdir, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import writeFileAtomic from 'write-file-atomic'
import type { LoadResult } from '@shared/types/applicationState'
import { UnsupportedStateVersion } from './codec'

export interface StorageHooks {
  beforeReplace?: (pathname: string, value: string) => Promise<void>
}

export class AtomicJsonFile<T> {
  private pending: Promise<void> = Promise.resolve()
  private initialized = false
  private readonly fallback: T
  private protectedReason: 'invalid-data' | 'unreadable' | 'unsupported-version' | null = null

  constructor(
    private readonly pathname: string,
    private readonly parse: (value: unknown) => T,
    defaults: () => T,
    private readonly hooks: StorageHooks = {}
  ) {
    this.fallback = defaults()
  }

  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const task = this.pending.then(operation)
    // A failed write must not prevent a later valid write from being attempted.
    this.pending = task.then(
      () => {},
      () => {}
    )
    return task
  }

  private async read(): Promise<LoadResult<T>> {
    this.initialized = true
    if (this.protectedReason) {
      return {
        status: 'read-only-defaulted',
        value: structuredClone(this.fallback),
        reason: this.protectedReason
      }
    }
    let content: string
    try {
      content = await readFile(this.pathname, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { status: 'defaulted', value: structuredClone(this.fallback), reason: 'missing' }
      }
      this.protectedReason = 'unreadable'
      return {
        status: 'read-only-defaulted',
        value: structuredClone(this.fallback),
        reason: 'unreadable'
      }
    }
    try {
      return { status: 'loaded', value: this.parse(JSON.parse(content)) }
    } catch (error) {
      this.protectedReason =
        error instanceof UnsupportedStateVersion ? 'unsupported-version' : 'invalid-data'
      return {
        status: 'read-only-defaulted',
        value: structuredClone(this.fallback),
        reason: this.protectedReason
      }
    }
  }

  load(): Promise<LoadResult<T>> {
    return this.enqueue(() => this.read())
  }

  async write(value: T): Promise<void> {
    // Capture this request before earlier writes or initialization can yield control.
    const serialized = JSON.stringify(this.parse(value))
    return this.enqueue(async() => {
      if (!this.initialized) await this.read()
      if (this.protectedReason) throw new Error(`State file is read-only: ${this.protectedReason}`)
      await mkdir(path.dirname(this.pathname), { recursive: true })
      if (this.hooks.beforeReplace) await this.hooks.beforeReplace(this.pathname, serialized)
      await writeFileAtomic(this.pathname, serialized, { encoding: 'utf8', mode: 0o600 })
    })
  }

  remove(validate: (value: T) => void): Promise<void> {
    return this.enqueue(async() => {
      const result = await this.read()
      if (result.status === 'defaulted') return
      if (result.status !== 'loaded') throw new Error('State file is read-only')
      validate(result.value)
      try {
        await unlink(this.pathname)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    })
  }
}
