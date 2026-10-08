import './documentVirtualizer.css'

// Below this many elements a full layout is cheap enough to keep every block rendered.
const MIN_VIRTUAL_ELEMENTS = 4000
// How long a restored position waits for the document to grow tall enough.
const RESTORE_PATIENCE_MS = 10000

/** A scroll position that survives estimated block sizes: a top-level block index and a px offset into it. */
export interface ScrollAnchor {
  block: number
  offset: number
}

const viewportTop = (scroller: HTMLElement): number =>
  scroller.getBoundingClientRect().top + scroller.clientTop

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE

/**
 * Lets Chromium skip style, layout and paint for off-screen top-level blocks of
 * a long document, so replacing it only lays out the viewport. A skipped block
 * that was never rendered has an estimated height until it comes into view.
 *
 * The editor disables native scroll anchoring, so when blocks entirely above
 * the viewport change height (an estimate replaced, an image loaded), or a
 * block across its top edge is drawn for the first time, the scroll position
 * is compensated before that frame is painted.
 * The caller owns the Muya document root and must destroy this before it.
 */
export class DocumentVirtualizer {
  private readonly heights = new WeakMap<Element, number>()
  // Blocks whose content is currently not drawn. Chromium reports a block as
  // shown only after the resize it causes, so this still holds it then.
  private readonly skipped = new WeakSet<Element>()
  private readonly resizeObserver: ResizeObserver
  private readonly mutationObserver: MutationObserver
  private blockCount = 0
  // The reading position as of the last scroll. When most blocks are
  // re-created at once (a forced re-render, a whole-document undo, replacing
  // everything), the new ones above the viewport start as estimates, so the
  // position is restored from this instead.
  private anchor: ScrollAnchor | null = null
  // `applied` is the scrollTop it was last given; any other value means
  // something else scrolled since.
  private pending: { anchor: ScrollAnchor | null; top: number; applied: number | null; until: number } | null = null
  private readonly rootObserver: ResizeObserver

  constructor(
    private readonly root: HTMLElement,
    private readonly scroller: HTMLElement
  ) {
    this.resizeObserver = new ResizeObserver((entries) => this.compensate(entries))
    // Created second, so it runs after the compensation of the same frame.
    this.rootObserver = new ResizeObserver(() => this.applyPending())
    this.mutationObserver = new MutationObserver((records) => this.handleMutations(records))
    this.mutationObserver.observe(root, { childList: true })
    this.rootObserver.observe(root)
    root.addEventListener('contentvisibilityautostatechange', this.trackSkipped, true)
    this.reset()
  }

  private readonly trackSkipped = (event: Event): void => {
    const block = event.target as Element
    if ((event as Event & { skipped: boolean }).skipped) this.skipped.add(block)
    else this.skipped.delete(block)
  }

  get enabled(): boolean {
    return this.root.classList.contains('mt-virtualized')
  }

  /**
   * Call synchronously after the document content was replaced. `anchor` is
   * the position about to be restored: its block is drawn first, so its real
   * height counts from the start.
   */
  reset(anchor: ScrollAnchor | null = null): void {
    this.mutationObserver.takeRecords()
    this.resizeObserver.disconnect()
    this.blockCount = this.root.children.length
    this.anchor = null
    this.pending = null
    const enabled = this.root.getElementsByTagName('*').length >= MIN_VIRTUAL_ELEMENTS
    this.root.classList.toggle('mt-virtualized', enabled)
    if (!enabled) return
    const anchorBlock = anchor && (this.root.children[anchor.block] as HTMLElement | undefined)
    if (anchorBlock) {
      anchorBlock.style.contentVisibility = 'visible'
      // By then it is on screen, so it stays drawn and its size is remembered.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => anchorBlock.style.removeProperty('content-visibility'))
      )
    }
    // Recorded now, while the other blocks still have their estimated heights:
    // by the first observation, blocks near the viewport are already drawn,
    // and that growth must count as a change.
    for (const block of this.root.children) {
      this.heights.set(block, block.getBoundingClientRect().height)
      this.resizeObserver.observe(block)
    }
  }

  /**
   * Scrolls back to a saved position: to `anchor` while the document is
   * virtualized (blocks above it may be estimates), otherwise to `top` in
   * scroller px. `anchor` must have been passed to `reset` before. A position
   * the document is still too short for (a diagram above it shows its
   * placeholder) is applied again as the document grows, until something
   * else scrolls it.
   */
  restore(anchor: ScrollAnchor | null, top: number): void {
    this.pending = { anchor, top, applied: null, until: performance.now() + RESTORE_PATIENCE_MS }
    this.applyPending()
  }

  private applyPending(): void {
    const pending = this.pending
    if (!pending) return
    const { scroller } = this
    const moved = pending.applied !== null && Math.abs(scroller.scrollTop - pending.applied) > 1
    if (moved || performance.now() > pending.until) {
      this.pending = null
      return
    }
    const block = this.enabled && pending.anchor ? this.root.children[pending.anchor.block] : undefined
    const target = block
      ? scroller.scrollTop + block.getBoundingClientRect().top - viewportTop(scroller) + pending.anchor!.offset
      : pending.top
    scroller.scrollTop = target
    pending.applied = scroller.scrollTop
    if (block) this.anchor = pending.anchor
    if (Math.abs(scroller.scrollTop - target) <= 1) this.pending = null
  }

  /** The block at the top of the viewport, or null when not virtualized. Call on every scroll. */
  measureAnchor(): ScrollAnchor | null {
    const blocks = this.root.children
    if (!this.enabled || !blocks.length) return (this.anchor = null)
    const top = viewportTop(this.scroller)
    let low = 0
    let high = blocks.length - 1
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (blocks[middle].getBoundingClientRect().top <= top) low = middle
      else high = middle - 1
    }
    const offset = top - blocks[low].getBoundingClientRect().top
    return (this.anchor = { block: low, offset })
  }

  destroy(): void {
    this.root.removeEventListener('contentvisibilityautostatechange', this.trackSkipped, true)
    this.mutationObserver.disconnect()
    this.resizeObserver.disconnect()
    this.rootObserver.disconnect()
    this.root.classList.remove('mt-virtualized')
  }

  private handleMutations(records: MutationRecord[]): void {
    if (!this.enabled) return
    let removed = 0
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!isElement(node)) continue
        removed++
        this.resizeObserver.unobserve(node)
      }
      // Blocks inserted later (typing, paste, undo) are observed too.
      for (const node of record.addedNodes) if (isElement(node)) this.resizeObserver.observe(node)
    }
    const anchor = this.anchor
    if (anchor && removed > 1 && removed >= this.blockCount / 2) {
      this.reset(anchor)
      this.restore(anchor, this.scroller.scrollTop)
    } else {
      this.blockCount = this.root.children.length
    }
  }

  private compensate(entries: ResizeObserverEntry[]): void {
    const changes: Array<{ block: Element; delta: number }> = []
    for (const entry of entries) {
      if (!entry.target.isConnected) continue
      const height = entry.borderBoxSize[0].blockSize
      const previous = this.heights.get(entry.target)
      this.heights.set(entry.target, height)
      // Client rects and observed sizes round differently by a fraction of a pixel.
      if (previous !== undefined && Math.abs(height - previous) > 0.05) {
        changes.push({ block: entry.target, delta: height - previous })
      }
    }
    if (!changes.length || !this.scroller.scrollTop) return
    changes.sort((a, b) =>
      a.block.compareDocumentPosition(b.block) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
    const top = viewportTop(this.scroller)
    // Rects are already final; undo the growth of earlier blocks to test where
    // each block was before this frame. A block across the viewport top that
    // was skipped drew nothing there, so what is shown starts below it.
    let shift = 0
    for (const { block, delta } of changes) {
      const rect = block.getBoundingClientRect()
      const wasAbove = rect.bottom - (shift + delta) <= top + 0.5
      const wasBlankAtTop = this.skipped.has(block) && rect.top - shift < top
      if (!wasAbove && !wasBlankAtTop) break
      shift += delta
    }
    if (!shift) return
    this.scroller.scrollTop += shift
    if (this.pending) this.pending.applied = this.scroller.scrollTop
  }
}
