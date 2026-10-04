import type { HarnessId, HarnessStatus, ListModelsResult, ModelOption } from '@shared/types/agent'

export interface HarnessMeta {
  id: HarnessId
  title: string
  /** Program name searched on PATH when the settings path is empty. */
  cmd: string
  pathKey: 'agentOpencodePath' | 'agentPiPath' | 'agentCursorPath'
}

export const HARNESS_CARDS: readonly HarnessMeta[] = [
  { id: 'opencode', title: 'OpenCode', cmd: 'opencode', pathKey: 'agentOpencodePath' },
  { id: 'pi', title: 'Pi', cmd: 'pi-acp', pathKey: 'agentPiPath' },
  { id: 'cursor', title: 'Cursor', cmd: 'agent', pathKey: 'agentCursorPath' }
]

export type HarnessCardKind = 'found' | 'missing' | 'login' | 'no_models' | 'failed'

export const harnessCardKind = (
  status: HarnessStatus | undefined,
  models: ListModelsResult | null
): HarnessCardKind => {
  if (!status || !status.found || status.reason === 'not_found' || status.reason === 'not_executable') {
    return 'missing'
  }
  if (status.reason === 'auth_required') return 'login'
  if (status.reason === 'init_failed') return 'failed'
  if (status.reason === 'no_models') return 'no_models'
  if (!models) return 'found'
  if (models.ok) return models.models.length === 0 ? 'no_models' : 'found'
  if (models.reason === 'no_models') return 'no_models'
  if (models.reason === 'auth_required') return 'login'
  if (models.reason === 'not_found' || models.reason === 'not_executable') return 'missing'
  return 'failed'
}

export const modelRows = (models: ListModelsResult | null): ModelOption[] =>
  models && models.ok ? models.models : []

/** A running turn keeps its harness. The radio can move again after the turn ends. */
export const harnessChangeAllowed = (turnActive: boolean): boolean => !turnActive
