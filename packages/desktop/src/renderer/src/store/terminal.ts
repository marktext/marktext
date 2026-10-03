import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createUnloadBag } from './releaseOnUnload'

export interface TerminalExit {
  termId: string
  code: number | null
}

export const useTerminalStore = defineStore('terminal', () => {
  const exits = ref<TerminalExit[]>([])
  const bag = createUnloadBag()

  function listen(): void {
    bag.listen((add) => {
      if (!window.term) return

      add(window.term.onData(() => {
        // Scrollback belongs to the xterm instance. The listener is held
        // here so unload can drop it; the bytes are not copied.
      }))
      add(window.term.onExit((termId, code) => {
        exits.value.push({ termId, code })
      }))
    })
  }

  return {
    exits,
    listen,
    stop: bag.stop
  }
})
