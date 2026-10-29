import { watch, type Ref } from 'vue'
import dragula from 'dragula'
import autoScroll from 'dom-autoscroller'
import { useEditorStore } from '@/store/editor'
import '@/assets/styles/tabDrag.css'

interface AutoScroller {
  readonly down: boolean
  destroy(forceCleanAnimation?: boolean): void
}

// CSS pixels; tolerate pointer drift so a click is not swallowed as a drag (#4895).
const DRAG_THRESHOLD_PX = 5

export const useTabReorder = (
  container: Ref<HTMLElement | null>,
  scrollContainer: Ref<HTMLElement | null>,
  direction: 'horizontal' | 'vertical'
): void => {
  const editorStore = useEditorStore()

  watch([container, scrollContainer], ([list, scroller], _previous, onCleanup) => {
    if (!list || !scroller) return

    let originalNext: ChildNode | null = null
    const positions = new Map<HTMLElement, { x: number; y: number }>()
    const animations = new Map<HTMLElement, Animation>()
    const stopAnimations = (): void => {
      for (const animation of animations.values()) animation.cancel()
      animations.clear()
    }
    const rememberPositions = (): void => {
      positions.clear()
      for (const child of list.children) {
        if (child instanceof HTMLElement && !child.classList.contains('gu-mirror')) {
          positions.set(child, { x: child.offsetLeft, y: child.offsetTop })
        }
      }
    }
    const animateReorder = (dragged: Element): void => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      for (const [row, previous] of positions) {
        if (row === dragged) continue
        const dx = previous.x - row.offsetLeft
        const dy = previous.y - row.offsetTop
        if (dx === 0 && dy === 0) continue
        // Include unfinished motion so reversing a drag does not snap neighboring rows.
        const transform = new DOMMatrixReadOnly(getComputedStyle(row).transform)
        animations.get(row)?.cancel()
        animations.set(row, row.animate([
          { transform: `translate(${dx + transform.m41}px, ${dy + transform.m42}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 150, easing: 'ease-out' }))
      }
      rememberPositions()
    }
    // Preserve Vue's fragment anchors as well as its element order before reconciliation.
    const restoreDomOrder = (element: Element, source: Element): void => {
      stopAnimations()
      source.insertBefore(element, originalNext?.parentNode === source ? originalNext : null)
    }
    const drake = dragula([list], {
      direction,
      revertOnSpill: true,
      mirrorContainer: list,
      ignoreInputTextSelection: false,
      slideFactorX: DRAG_THRESHOLD_PX,
      slideFactorY: DRAG_THRESHOLD_PX,
      moves: (element, _source, handle) =>
        !!element?.hasAttribute('data-id') &&
        !element.classList.contains('list-leave-active') &&
        !handle?.closest('button')
    })
      .on('drag', (element) => {
        originalNext = element.nextSibling
        rememberPositions()
      })
      .on('shadow', animateReorder)
      .on('cancel', (element, _container, source) => {
        restoreDomOrder(element, source)
      })
      .on('drop', (element, _target, source, sibling) => {
        const fromId = element.getAttribute('data-id')
        const toId = sibling?.classList.contains('gu-mirror')
          ? null
          : sibling?.getAttribute('data-id') ?? null

        restoreDomOrder(element, source)
        if (fromId) editorStore.EXCHANGE_TABS_BY_ID({ fromId, toId })
      })
      .on('dragend', () => {
        stopAnimations()
        positions.clear()
      })

    const autoScroller: AutoScroller = autoScroll([scroller], {
      margin: 20,
      maxSpeed: 6,
      scrollWhenOutside: false,
      autoScroll: () => autoScroller.down && drake.dragging
    })

    onCleanup(() => {
      stopAnimations()
      autoScroller.destroy(true)
      drake.cancel(true)
      drake.destroy()
    })
  }, { flush: 'post' })
}
