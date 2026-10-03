import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createUnloadBag } from './releaseOnUnload'

export const useCommentsStore = defineStore('comments', () => {
  const changedFile = ref<string | null>(null)
  const bag = createUnloadBag()

  function listen(): void {
    bag.listen((add) => {
      if (!window.comments) return

      add(window.comments.onChanged(({ file }) => {
        changedFile.value = file
      }))
    })
  }

  return {
    changedFile,
    listen,
    stop: bag.stop
  }
})
