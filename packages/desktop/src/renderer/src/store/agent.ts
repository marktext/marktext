import type { ChatEvent, HarnessStatus, RepoState } from '@shared/types/agent'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePreferencesStore } from './preferences'
import { createUnloadBag } from './releaseOnUnload'

const NONE: RepoState = { kind: 'none' }

export const useAgentStore = defineStore('agent', () => {
  const repoState = ref<RepoState>(NONE)
  const harnessStatuses = ref<HarnessStatus[]>([])
  const events = ref<ChatEvent[]>([])
  /** Empty until `getSelection` answers. A missing model blocks sending. */
  const selectionModel = ref<string | null>(null)
  const selectionKnown = ref(false)
  const bag = createUnloadBag()

  // D25: agent chrome mounts only while this is true. A disabled mode or a
  // folder that is not a git repo must leave the window DOM unchanged.
  const agentAvailable = computed(() => {
    return usePreferencesStore().agentModeEnabled && repoState.value.kind === 'repo'
  })

  const turnInProgress = computed(() => {
    let running = false
    for (const event of events.value) {
      if (event.type === 'turn_started') running = true
      else if (event.type === 'turn_finished') running = false
    }
    return running
  })

  function refreshSelection(): void {
    const agent = window.agent
    if (!agent?.getSelection) return
    agent.getSelection().then((next) => {
      selectionModel.value = next?.model || null
      selectionKnown.value = true
    }).catch(() => {
      selectionModel.value = null
      selectionKnown.value = true
    })
  }

  function refreshRepoState(): void {
    const run = async(): Promise<void> => {
      if (!window.agent || !usePreferencesStore().agentModeEnabled) {
        repoState.value = NONE
        return
      }

      try {
        repoState.value = await window.agent.getRepoState()
      } catch {
        // Main rejects the probe while agent mode is off, and a failed probe
        // must not leave the previous repository in place.
        repoState.value = NONE
      }
    }

    run().catch(() => undefined)
  }

  // The preference can change from another window after this one has already
  // probed. The gate reads the flag directly; the probe has to follow so a
  // later enable still learns whether the folder is a repo.
  watch(
    () => usePreferencesStore().agentModeEnabled,
    () => {
      refreshRepoState()
    }
  )

  function listen(): void {
    bag.listen((add) => {
      if (window.agent) {
        add(window.agent.onEvent((event) => {
          events.value.push(event)
        }))
        add(window.agent.onHarnessStatusChanged((statuses) => {
          harnessStatuses.value = statuses
          refreshRepoState()
          refreshSelection()
        }))
      }

      if (window.electron?.ipcRenderer) {
        add(window.electron.ipcRenderer.on('mt::open-directory', () => {
          refreshRepoState()
        }))
      }
    })

    refreshRepoState()
    refreshSelection()
  }

  return {
    repoState,
    harnessStatuses,
    events,
    selectionModel,
    selectionKnown,
    agentAvailable,
    turnInProgress,
    refreshRepoState,
    refreshSelection,
    listen,
    stop: bag.stop
  }
})
