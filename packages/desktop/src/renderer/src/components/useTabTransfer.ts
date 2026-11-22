import { watch, type Ref } from 'vue'
import { useEditorStore } from '@/store/editor'

// Match tab clicks with pointer drift; only deliberate movement starts a drag.
const THRESHOLD_PX = 5

export const useTabTransfer = (
  strip: Ref<HTMLElement | null>,
  scroller: Ref<HTMLElement | null>
): void => {
  const editor = useEditorStore()
  watch(
    [strip, scroller],
    ([list, scroll], _old, onCleanup) => {
      if (!list || !scroll) return
      const ipc = window.electron.ipcRenderer
      let drag: {
        id: string
        pointerId: number
        x: number
        y: number
        started: boolean
        accepted: Promise<boolean> | null
        ghost: HTMLElement | null
        capture: HTMLElement
      } | null = null
      let swallowClick = false
      const rows = (): HTMLElement[] => [...list.querySelectorAll<HTMLElement>('li[data-id]')]
      const publish = (): void => {
        const rect = list.closest('.editor-tabs')?.getBoundingClientRect()
        if (!rect || rect.width === 0 || rect.height === 0) {
          ipc.send('mt::tabs::strip', null)
          return
        }
        ipc.send('mt::tabs::strip', {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          tabs: rows().map((row) => {
            const rect = row.getBoundingClientRect()
            return { id: row.dataset.id ?? '', middle: (rect.left + rect.right) / 2 }
          })
        })
      }
      const clearMarker = (): void => {
        list.closest('.editor-tabs')?.classList.remove('tab-drop-target')
        for (const row of rows()) row.classList.remove('tab-insert-before', 'tab-insert-after')
      }
      const unsubscribe = ipc.on('mt::tabs::drag-position', (_event, position) => {
        clearMarker()
        if (!position) return
        list.closest('.editor-tabs')?.classList.add('tab-drop-target')
        const row = rows().find((row) => row.dataset.id === position.beforeId)
        if (row) row.classList.add('tab-insert-before')
        else rows().at(-1)?.classList.add('tab-insert-after')
      })
      const down = (event: PointerEvent): void => {
        const target = event.target instanceof Element ? event.target : null
        const row = target?.closest<HTMLElement>('li[data-id]')
        if (event.button !== 0 || !row || target?.closest('button') || drag) return
        drag = {
          id: row.dataset.id ?? '',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          started: false,
          accepted: null,
          ghost: null,
          capture: row
        }
        row.setPointerCapture(event.pointerId)
      }
      const move = (event: PointerEvent): void => {
        if (!drag || event.pointerId !== drag.pointerId) return
        if (
          !drag.started &&
          Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= THRESHOLD_PX
        )
          return
        if (!drag.started) {
          drag.started = true
          swallowClick = true
          drag.accepted = ipc.invoke('mt::tabs::begin-drag', drag.id)
          const row = rows().find((row) => row.dataset.id === drag?.id)
          if (row) {
            drag.ghost = document.createElement('div')
            drag.ghost.className = 'tab-transfer-ghost'
            drag.ghost.textContent = row.textContent
            document.body.append(drag.ghost)
            row.classList.add('tab-transferring')
          }
        }
        event.preventDefault()
        if (drag.ghost) {
          drag.ghost.style.left = `${event.clientX + 12}px`
          drag.ghost.style.top = `${event.clientY + 12}px`
        }
        const rect = scroll.getBoundingClientRect()
        if (event.clientY >= rect.top && event.clientY <= rect.bottom) {
          if (event.clientX < rect.left + 20) scroll.scrollLeft -= 12
          if (event.clientX > rect.right - 20) scroll.scrollLeft += 12
        }
        publish()
      }
      const finish = (event: PointerEvent | null, cancel: boolean): void => {
        const current = drag
        if (!current) return
        drag = null
        current.ghost?.remove()
        for (const row of rows()) row.classList.remove('tab-transferring')
        if (current.capture.hasPointerCapture(current.pointerId))
          current.capture.releasePointerCapture(current.pointerId)
        clearMarker()
        if (!current.started) return
        setTimeout(() => {
          swallowClick = false
        }, 0)
        const rect = list.closest('.editor-tabs')?.getBoundingClientRect()
        if (
          !cancel &&
          event &&
          rect &&
          event.clientX >= rect.left &&
          event.clientX < rect.right &&
          event.clientY >= rect.top &&
          event.clientY < rect.bottom
        ) {
          const sibling = rows().find(
            (row) =>
              row.dataset.id !== current.id &&
              event.clientX <
                (row.getBoundingClientRect().left + row.getBoundingClientRect().right) / 2
          )
          editor.EXCHANGE_TABS_BY_ID({ fromId: current.id, toId: sibling?.dataset.id ?? null })
        }
        void current.accepted
          ?.then((accepted) => {
            if (accepted) return ipc.invoke('mt::tabs::finish-drag', cancel)
          })
          .catch(console.error)
        publish()
      }
      const up = (event: PointerEvent): void => finish(event, false)
      const cancelled = (): void => finish(null, true)
      const key = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && drag) {
          event.preventDefault()
          event.stopPropagation()
          cancelled()
        }
      }
      const click = (event: MouseEvent): void => {
        if (!swallowClick) return
        swallowClick = false
        event.preventDefault()
        event.stopImmediatePropagation()
      }
      list.addEventListener('pointerdown', down)
      list.addEventListener('pointermove', move)
      list.addEventListener('pointerup', up)
      list.addEventListener('pointercancel', cancelled)
      list.addEventListener('lostpointercapture', cancelled)
      list.addEventListener('click', click, true)
      document.addEventListener('keydown', key, true)
      window.addEventListener('blur', publish)
      window.addEventListener('resize', publish)
      scroll.addEventListener('scroll', publish, { passive: true })
      const resize = new ResizeObserver(publish)
      resize.observe(list)
      resize.observe(scroll)
      const stop = watch(() => editor.tabs.map((file) => file.id), publish, { flush: 'post' })
      publish()
      onCleanup(() => {
        cancelled()
        unsubscribe()
        stop()
        resize.disconnect()
        list.removeEventListener('pointerdown', down)
        list.removeEventListener('pointermove', move)
        list.removeEventListener('pointerup', up)
        list.removeEventListener('pointercancel', cancelled)
        list.removeEventListener('lostpointercapture', cancelled)
        list.removeEventListener('click', click, true)
        document.removeEventListener('keydown', key, true)
        window.removeEventListener('blur', publish)
        window.removeEventListener('resize', publish)
        scroll.removeEventListener('scroll', publish)
        ipc.send('mt::tabs::strip', null)
      })
    },
    { flush: 'post' }
  )
}
