import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { createEmptyApplicationState } from '@shared/applicationState/defaults'
import type {
  ApplicationState,
  ApplicationStateStorage,
  DocumentRecoveryStorage,
  LoadResult,
  RecoveryRecord
} from '@shared/types/applicationState'
import { AtomicJsonFile, type StorageHooks } from './atomicJsonFile'
import { parseApplicationState, parseRecoveryRecord, validIdentity } from './codec'
import { createStateId } from './identity'

export class ApplicationStateStore implements ApplicationStateStorage {
  private readonly _file: AtomicJsonFile<ApplicationState>

  constructor(userDataPath: string, hooks: StorageHooks = {}) {
    this._file = new AtomicJsonFile(
      path.join(userDataPath, 'state', 'application-state.json'),
      parseApplicationState,
      () => createEmptyApplicationState(createStateId(), Date.now()),
      hooks
    )
  }

  load(): Promise<LoadResult<ApplicationState>> {
    return this._file.load()
  }
  write(state: ApplicationState): Promise<void> {
    return this._file.write(state)
  }
}

export class RecoveryStore implements DocumentRecoveryStorage {
  private readonly _files = new Map<string, AtomicJsonFile<RecoveryRecord | null>>()

  constructor(
    private readonly _userDataPath: string,
    private readonly _hooks: StorageHooks = {}
  ) {}

  private _pathname(windowId: string, documentId: string): string {
    if (!validIdentity(windowId) || !validIdentity(documentId))
      throw new Error('Invalid recovery identity')
    return path.join(this._userDataPath, 'recovery', windowId, `${documentId}.json`)
  }

  private _file(windowId: string, documentId: string): AtomicJsonFile<RecoveryRecord | null> {
    const pathname = this._pathname(windowId, documentId)
    let file = this._files.get(pathname)
    if (!file) {
      file = new AtomicJsonFile(
        pathname,
        (value) => {
          const record = parseRecoveryRecord(value)
          if (record.ownerWindowId !== windowId || record.documentId !== documentId) {
            throw new Error('Invalid recovery file ownership')
          }
          return record
        },
        () => null,
        this._hooks
      )
      this._files.set(pathname, file)
    }
    return file
  }

  async readWindow(windowId: string): Promise<RecoveryRecord[]> {
    if (!validIdentity(windowId)) throw new Error('Invalid recovery identity')
    let names: string[]
    try {
      names = await readdir(path.join(this._userDataPath, 'recovery', windowId))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const records: RecoveryRecord[] = []
    for (const name of names.sort()) {
      const documentId = name.endsWith('.json') ? name.slice(0, -5) : ''
      if (!validIdentity(documentId)) continue
      const result = await this._file(windowId, documentId).load()
      if (result.status === 'loaded' && result.value) records.push(result.value)
    }
    return records
  }

  async write(record: RecoveryRecord): Promise<void> {
    const parsed = parseRecoveryRecord(record)
    await this._file(parsed.ownerWindowId, parsed.documentId).write(parsed)
  }

  async remove(windowId: string, documentId: string): Promise<void> {
    await this._file(windowId, documentId).remove((record) => {
      if (record?.status === 'dirty') throw new Error('Cannot delete a dirty recovery record')
    })
  }
}
