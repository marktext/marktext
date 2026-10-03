import type { Thread } from '@shared/types/comments'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { createUnloadBag } from './releaseOnUnload'

export const useCommentsStore = defineStore('comments', () => {
  const changedFile = ref<string | null>(null)
  const threads = ref<Thread[]>([])
  const bag = createUnloadBag()

  const unresolvedCount = computed(
    () => threads.value.filter((thread) => thread.status === 'open').length
  )

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
    threads,
    unresolvedCount,
    listen,
    stop: bag.stop
  }
})
