import { computed, onMounted, onUnmounted, type Ref } from 'vue'
import { useProjectStore } from '@/store/project'
import notice from '@/services/notification'
import { t } from '@/i18n'

const ROW_SELECTOR = '[data-tree-path]'
const DRAG_TYPE = 'application/x-marktext-tree-item'
const EXPAND_DELAY_MS = 700
const SCROLL_EDGE_PX = 32

interface DragRow {
  element: HTMLElement
  pathname: string
  rootKey: string
  directory: boolean
}

/** Rows expose paths and directory flags through data-tree-*; their root container supplies the root key.
 * Only a session started in this mounted tree can issue a move request.
 */
export const useTreeDragDrop = (
  container: Ref<HTMLElement | null>,
  requestReveal: (pathname: string) => void,
  findRow: (pathname: string) => HTMLElement | undefined
) => {
  const project = useProjectStore()
  const busy = computed(() => project.movingSource !== null)
  let source: DragRow | null = null
  let target: DragRow | null = null
  let expandTimer: ReturnType<typeof setTimeout> | undefined
  let scrollFrame = 0
  let pointerY = 0
  let disposed = false

  const rowAt = (event: Event): DragRow | null => {
    if (!(event.target instanceof Element)) return null
    const element = event.target.closest<HTMLElement>(ROW_SELECTOR)
    if (!element || !container.value?.contains(element)) return null
    const rootKey = element.closest<HTMLElement>('[data-tree-root]')?.dataset.treeRoot
    const pathname = element.dataset.treePath
    if (!rootKey || !pathname) return null
    return { element, pathname, rootKey, directory: element.dataset.treeDirectory === 'true' }
  }

  const targetAt = (event: Event): DragRow | null => {
    const row = rowAt(event)
    if (!row || row.directory) return row
    const pathname = window.path.dirname(row.pathname)
    const element = findRow(pathname)
    if (!element || !container.value?.contains(element)) return null
    return { element, pathname, rootKey: row.rootKey, directory: true }
  }

  const validTarget = (row: DragRow | null): row is DragRow => {
    if (!source || !row?.directory || row.rootKey !== source.rootKey) return false
    const relative = window.path.relative(source.pathname, row.pathname)
    return relative !== '' &&
      (relative === '..' || relative.startsWith(`..${window.path.sep}`) || window.path.isAbsolute(relative)) &&
      window.path.dirname(source.pathname) !== row.pathname
  }

  const clearTarget = (): void => {
    clearTimeout(expandTimer)
    expandTimer = undefined
    target?.element.classList.remove('tree-drop-target')
    target = null
  }

  const finishDrag = (): void => {
    clearTarget()
    source?.element.classList.remove('tree-drag-source')
    source = null
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }

  const scroll = (): void => {
    const viewport = container.value
    if (!source || !viewport) return
    const rect = viewport.getBoundingClientRect()
    const delta = pointerY < rect.top + SCROLL_EDGE_PX ? -8
      : pointerY > rect.bottom - SCROLL_EDGE_PX ? 8 : 0
    if (delta === 0) {
      scrollFrame = 0
      return
    }
    viewport.scrollTop += delta
    scrollFrame = requestAnimationFrame(scroll)
  }

  const start = (event: DragEvent): void => {
    const row = rowAt(event)
    const root = project.roots.find(root => root.key === row?.rootKey)
    if (busy.value || project.renameCache || project.createCache.dirname || !row ||
      row.element.draggable !== true || root?.status !== 'ready' || !event.dataTransfer) {
      event.preventDefault()
      return
    }
    finishDrag()
    source = row
    event.dataTransfer.setData(DRAG_TYPE, row.pathname)
    event.dataTransfer.effectAllowed = 'move'
    row.element.classList.add('tree-drag-source')
    event.stopPropagation()
  }

  const over = (event: DragEvent): void => {
    if (!source) return
    event.preventDefault()
    event.stopPropagation()
    pointerY = event.clientY
    if (!scrollFrame) scrollFrame = requestAnimationFrame(scroll)
    const row = targetAt(event)
    const valid = validTarget(row)
    if (event.dataTransfer) event.dataTransfer.dropEffect = valid ? 'move' : 'none'
    if (target?.element === row?.element && valid) return
    clearTarget()
    if (!valid) return
    target = row
    row.element.classList.add('tree-drop-target')
    expandTimer = setTimeout(() => {
      const node = project.FIND_TREE_NODE(row.pathname)
      if (node?.isDirectory) project.SET_FOLDER_COLLAPSED(node, false)
    }, EXPAND_DELAY_MS)
  }

  const drop = async(event: DragEvent): Promise<void> => {
    if (!source) return
    event.preventDefault()
    event.stopPropagation()
    const row = targetAt(event)
    const request = validTarget(row)
      ? { rootKey: source.rootKey, source: source.pathname, targetDirectory: row.pathname }
      : null
    finishDrag()
    if (!request || busy.value) return
    project.movingSource = request.source
    try {
      const result = await window.electron.ipcRenderer.invoke('mt::project-move-item', request)
      if (disposed) return
      if (result.status === 'moved') {
        requestReveal(result.destination)
        notice.notify({ title: t('sideBar.move.title'), message: t('sideBar.move.completed'), type: 'primary' })
      } else if (result.status === 'failed') {
        notice.notify({ title: t('sideBar.move.title'), message: result.message, type: 'error' })
        await window.electron.ipcRenderer.invoke('mt::project-retry-root', request.rootKey)
      }
    } catch (error) {
      notice.notify({ title: t('sideBar.move.title'), message: error instanceof Error ? error.message : String(error), type: 'error' })
    } finally {
      project.movingSource = null
    }
  }

  // Internal drags must never reach the global import handler or the editor's text/image handlers.
  const guardOutsideTree = (event: DragEvent): void => {
    if (!source || (event.target instanceof Node && container.value?.contains(event.target))) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    clearTarget()
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    if (event.type === 'drop') finishDrag()
  }

  const leave = (event: DragEvent): void => {
    if (event.relatedTarget instanceof Node && container.value?.contains(event.relatedTarget)) return
    clearTarget()
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
  }

  const blockBusyActions = (event: Event): void => {
    if (event instanceof KeyboardEvent && !['F2', 'Enter', 'Delete', 'Backspace'].includes(event.key)) return
    if (busy.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  onMounted(() => {
    const viewport = container.value
    if (!viewport) return
    viewport.addEventListener('dragstart', start)
    viewport.addEventListener('dragover', over)
    viewport.addEventListener('drop', drop)
    viewport.addEventListener('dragleave', leave)
    for (const type of ['click', 'contextmenu', 'keydown']) viewport.addEventListener(type, blockBusyActions, true)
    document.addEventListener('dragover', guardOutsideTree, true)
    document.addEventListener('drop', guardOutsideTree, true)
    document.addEventListener('dragend', finishDrag, true)
  })
  onUnmounted(() => {
    disposed = true
    finishDrag()
    const viewport = container.value
    viewport?.removeEventListener('dragstart', start)
    viewport?.removeEventListener('dragover', over)
    viewport?.removeEventListener('drop', drop)
    viewport?.removeEventListener('dragleave', leave)
    for (const type of ['click', 'contextmenu', 'keydown']) viewport?.removeEventListener(type, blockBusyActions, true)
    document.removeEventListener('dragover', guardOutsideTree, true)
    document.removeEventListener('drop', guardOutsideTree, true)
    document.removeEventListener('dragend', finishDrag, true)
  })
  return { busy }
}
