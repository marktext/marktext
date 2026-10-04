import { defineStore } from 'pinia'
import { ref } from 'vue'

export type DiffScope = 'turn' | 'worktree'
export type DiffViewMode = 'unified' | 'side'

export interface DiffTurn {
  turnId: string
  paths: string[]
  /** Wall time the tab was pointed at this turn. The scope label shows it. */
  at: number
}

export const useDiffStore = defineStore('diff', () => {
  const open = ref(false)
  const active = ref(false)
  const scope = ref<DiffScope>('turn')
  const view = ref<DiffViewMode>('unified')
  const turn = ref<DiffTurn | null>(null)

  const showTurn = (turnId: string, paths: readonly string[]): void => {
    if (paths.length === 0) return
    turn.value = { turnId, paths: [...paths], at: Date.now() }
    scope.value = 'turn'
    open.value = true
    active.value = true
  }

  const showFile = (): void => {
    active.value = false
  }

  const activate = (): void => {
    if (!open.value) return
    active.value = true
  }

  const close = (): void => {
    open.value = false
    active.value = false
  }

  const setScope = (next: DiffScope): void => {
    scope.value = next
  }

  const setView = (next: DiffViewMode): void => {
    view.value = next
  }

  return {
    open,
    active,
    scope,
    view,
    turn,
    showTurn,
    showFile,
    activate,
    close,
    setScope,
    setView
  }
})
