import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  MODEL_PROBE_TIMEOUT_MS,
  type HarnessId,
  type ListModelsResult,
  type ModelOption
} from '@shared/types/agent'
import { AcpAuthRequiredError, AcpConnection, type SessionConfigSnapshot } from './acpConnection'
import { HARNESS_DESCRIPTORS } from './harnessRegistry'
import { resolveHarnessCommand } from './resolveHarnessCommand'

interface ModelCacheEntry {
  fetchedAt: string
  models: ModelOption[]
}

type ModelCacheFile = Partial<Record<HarnessId, ModelCacheEntry>>

export interface ListModelsInput {
  harness: HarnessId
  refresh?: boolean
  /** Null when no repository is open; the probe then uses a temporary directory. */
  repoRoot: string | null
  configuredPath: string
  cacheFile: string
  now?: () => string
}

const isModelOption = (value: unknown): value is ModelOption => {
  if (!value || typeof value !== 'object') return false
  const option = value as { id?: unknown, label?: unknown }
  return typeof option.id === 'string' && option.id.length > 0 && typeof option.label === 'string'
}

const readCache = (cacheFile: string): ModelCacheFile => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as ModelCacheFile
  } catch {
    return {}
  }
}

const cachedModels = (cache: ModelCacheFile, harness: HarnessId): ModelOption[] | null => {
  const entry = cache[harness]
  if (!entry || !Array.isArray(entry.models)) return null
  const models = entry.models.filter(isModelOption)
  return models.length > 0 ? models : null
}

const writeCacheFile = (cacheFile: string, next: ModelCacheFile): void => {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
  const tmp = `${cacheFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`)
  fs.renameSync(tmp, cacheFile)
}

const writeCache = (cacheFile: string, harness: HarnessId, models: ModelOption[], now: string): void => {
  const next = readCache(cacheFile)
  next[harness] = { fetchedAt: now, models }
  writeCacheFile(cacheFile, next)
}

/** A new binary must not keep the previous catalog. Other harnesses stay. */
export const forgetCachedModels = (cacheFile: string, ids: readonly HarnessId[]): void => {
  if (ids.length === 0) return
  const next = readCache(cacheFile)
  let dropped = false
  for (const id of ids) {
    if (next[id] == null) continue
    delete next[id]
    dropped = true
  }
  if (dropped) writeCacheFile(cacheFile, next)
}

const flattenOptions = (options: unknown): { value: string, name: string }[] => {
  if (!Array.isArray(options)) return []
  const models: { value: string, name: string }[] = []
  for (const item of options) {
    if (!item || typeof item !== 'object') continue
    const record = item as { value?: unknown, name?: unknown, options?: unknown }
    if (typeof record.value === 'string' && record.value.length > 0) {
      const name = typeof record.name === 'string' && record.name.length > 0 ? record.name : record.value
      models.push({ value: record.value, name })
    } else if (Array.isArray(record.options)) {
      models.push(...flattenOptions(record.options))
    }
  }
  return models
}

/** `null` when the agent did not offer a non-empty `category == "model"` select. */
export const modelsFromSessionConfig = (
  options: readonly SessionConfigSnapshot[] | null | undefined
): ModelOption[] | null => {
  const model = options?.find((option) => option.category === 'model' && option.type === 'select')
  if (!model) return null
  const flat = flattenOptions(model.options)
  if (flat.length === 0) return null
  return flat.map((option) => ({ id: option.value, label: option.name }))
}

const withTimeout = <T>(work: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('model probe timed out'))
    }, ms)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

const probeModels = async(
  harness: HarnessId,
  configuredPath: string,
  repoRoot: string | null
): Promise<ListModelsResult> => {
  const descriptor = HARNESS_DESCRIPTORS.find((item) => item.id === harness)
  if (!descriptor) return { ok: false, reason: 'init_failed' }
  const resolved = resolveHarnessCommand(
    descriptor.defaultCommand,
    descriptor.defaultArgs,
    configuredPath
  )
  if (!resolved.ok) return { ok: false, reason: resolved.reason }

  const cwd = repoRoot ?? fs.mkdtempSync(path.join(os.tmpdir(), 'mt-model-probe-'))
  const ownedTmp = repoRoot ? null : cwd
  const holder: { connection: AcpConnection | null } = { connection: null }
  try {
    const probed = await withTimeout((async() => {
      const connection = await AcpConnection.start({
        command: resolved.command,
        args: resolved.args,
        cwd,
        harness,
        quirks: descriptor.quirks,
        onEvent: () => undefined
      })
      holder.connection = connection
      const created = await connection.newSession({ cwd, mcpServers: [] })
      const models = modelsFromSessionConfig(created.configOptions)
      await connection.close(created.sessionId).catch(() => undefined)
      if (!models) return { ok: false, reason: 'no_models' } as const
      return { ok: true, models } as const
    })(), MODEL_PROBE_TIMEOUT_MS)
    return probed
  } catch (error) {
    if (error instanceof AcpAuthRequiredError) return { ok: false, reason: 'auth_required' }
    return { ok: false, reason: 'init_failed' }
  } finally {
    if (holder.connection) await holder.connection.dispose()
    if (ownedTmp) fs.rmSync(ownedTmp, { recursive: true, force: true })
  }
}

/**
 * A stored catalog is reused until `refresh`. An empty catalog is not stored:
 * the next call probes again. The probe is its own process, not the window's harness.
 */
export const listModels = async(input: ListModelsInput): Promise<ListModelsResult> => {
  const cache = readCache(input.cacheFile)
  if (!input.refresh) {
    const stored = cachedModels(cache, input.harness)
    if (stored) return { ok: true, models: stored }
  }
  const result = await probeModels(input.harness, input.configuredPath, input.repoRoot)
  if (result.ok) {
    writeCache(input.cacheFile, input.harness, result.models, (input.now ?? (() => new Date().toISOString()))())
  }
  return result
}
