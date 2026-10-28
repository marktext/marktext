import { computed, onMounted, onUnmounted, nextTick, ref, watch, type Ref } from 'vue'

// Keep in sync with the row height in treeOpenedTab.vue.
const ROW_HEIGHT = 28
export const MIN_VISIBLE_ROWS = 4
const DEFAULT_HEIGHT = ROW_HEIGHT * MIN_VISIBLE_ROWS
const PROJECT_TREE_RESERVE = 150
const HEIGHT_KEY = 'side-bar-opened-files-height'

export const useOpenedFilesResize = (
  rowCount: Ref<number>,
  visible: Ref<boolean>,
  state?: { preferredHeight: Ref<number>; persist: (height: number) => void }
) => {
  const storedHeight = state ? DEFAULT_HEIGHT : Number(localStorage.getItem(HEIGHT_KEY))
  // Automatic layout clamps never replace the user's last explicit choice.
  const preferredHeight =
    state?.preferredHeight ??
    ref(Number.isFinite(storedHeight) && storedHeight > 0 ? storedHeight : DEFAULT_HEIGHT)
  const treeView = ref<HTMLElement | null>(null)
  const openedFilesList = ref<HTMLElement | null>(null)
  const resizeHandle = ref<HTMLElement | null>(null)
  const availableHeight = ref(DEFAULT_HEIGHT)
  const maximumHeight = computed(() => Math.min(rowCount.value * ROW_HEIGHT, availableHeight.value))
  const minimumHeight = computed(() => Math.min(DEFAULT_HEIGHT, maximumHeight.value))
  const openedFilesMaxHeight = computed(() =>
    Math.max(minimumHeight.value, Math.min(preferredHeight.value, maximumHeight.value))
  )

  const updateHeightLimit = (): void => {
    const view = treeView.value
    const list = openedFilesList.value
    if (!visible.value || !view || !list || list.offsetParent === null) return
    const listTop = list.getBoundingClientRect().top - view.getBoundingClientRect().top
    availableHeight.value = Math.max(
      0,
      view.clientHeight - listTop - (resizeHandle.value?.offsetHeight ?? 0) - PROJECT_TREE_RESERVE
    )
  }

  const persistHeight = (): void => {
    if (state) state.persist(preferredHeight.value)
    else localStorage.setItem(HEIGHT_KEY, String(preferredHeight.value))
  }

  const requestHeight = (height: number): void => {
    preferredHeight.value = Math.max(minimumHeight.value, Math.min(height, maximumHeight.value))
  }

  let pointerId: number | null = null
  let previousY = 0
  let dragged = false
  let capturedHandle: HTMLElement | null = null

  const stopResize = (): void => {
    const id = pointerId
    pointerId = null
    if (id !== null && capturedHandle?.hasPointerCapture(id)) {
      capturedHandle.releasePointerCapture(id)
    }
    capturedHandle = null
    if (dragged) persistHeight()
    dragged = false
  }

  const startResize = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary || pointerId !== null) return
    const handle = event.currentTarget as HTMLElement
    updateHeightLimit()
    pointerId = event.pointerId
    previousY = event.clientY
    capturedHandle = handle
    handle.setPointerCapture(event.pointerId)
    handle.focus({ preventScroll: true })
    event.preventDefault()
  }

  const handleResizeMove = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return
    const delta = event.clientY - previousY
    previousY = event.clientY
    if (!delta) return
    // Discard overshoot at either bound so reversing direction responds immediately.
    requestHeight(openedFilesMaxHeight.value + delta)
    dragged = true
    event.preventDefault()
  }

  const handleResizeEnd = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) stopResize()
  }

  const handleResizeKeydown = (event: KeyboardEvent): void => {
    const step = ROW_HEIGHT * (event.shiftKey ? MIN_VISIBLE_ROWS : 1)
    updateHeightLimit()
    let height: number
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        height = openedFilesMaxHeight.value - step
        break
      case 'ArrowDown':
      case 'ArrowRight':
        height = openedFilesMaxHeight.value + step
        break
      case 'Home':
        height = minimumHeight.value
        break
      case 'End':
        height = maximumHeight.value
        break
      default:
        return
    }
    event.preventDefault()
    requestHeight(height)
    persistHeight()
  }

  const observer = new ResizeObserver(updateHeightLimit)
  watch(
    [openedFilesList, resizeHandle, visible, rowCount],
    async() => {
      if (!visible.value || !resizeHandle.value) stopResize()
      // v-show's updated hook must finish before checking visibility and measuring.
      await nextTick()
      updateHeightLimit()
    },
    { flush: 'post' }
  )

  onMounted(() => {
    if (treeView.value) observer.observe(treeView.value)
    updateHeightLimit()
  })
  onUnmounted(() => {
    observer.disconnect()
    stopResize()
  })

  return {
    treeView,
    openedFilesList,
    resizeHandle,
    openedFilesMaxHeight,
    minimumHeight,
    maximumHeight,
    startResize,
    handleResizeMove,
    handleResizeEnd,
    handleResizeKeydown
  }
}
