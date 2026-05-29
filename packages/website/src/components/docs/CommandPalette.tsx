'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loadIndex, search, type IndexedPage, type SearchHit } from '@/lib/docs-search'
import { SearchIcon } from '@/components/Icons'

type Props = {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState<IndexedPage[] | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    loadIndex().then(setIndex).catch((err) => setError((err as Error).message))
    // Reset query each time the palette opens (keeps the UX predictable).
    setQuery('')
    setSelected(0)
    queueMicrotask(() => inputRef.current?.focus())
  }, [open])

  const hits: SearchHit[] = useMemo(() => {
    if (!index) return []
    if (!query.trim()) {
      // Default: show every page as a flat list (sorted by registry order).
      return index.map((page) => ({
        page,
        score: 0,
        snippet: page.hint ?? page.body.slice(0, 120)
      }))
    }
    return search(query, index)
  }, [index, query])

  const groups = useMemo(() => groupHits(hits), [hits])

  useEffect(() => {
    setSelected(0)
  }, [query])

  const navigateTo = useCallback(
    (hit: SearchHit) => {
      const href = hit.headingId ? hit.page.href + '#' + hit.headingId : hit.page.href
      router.push(href)
      onClose()
    },
    [router, onClose]
  )

  const hitsRef = useRef(hits)
  const selectedRef = useRef(selected)
  hitsRef.current = hits
  selectedRef.current = selected

  useEffect(() => {
    if (!open) return
    function onKey(ev: KeyboardEvent) {
      if (ev.isComposing) return
      if (ev.key === 'Escape') {
        ev.preventDefault()
        onClose()
        return
      }
      if (ev.key === 'ArrowDown') {
        ev.preventDefault()
        setSelected((s) => Math.min(s + 1, hitsRef.current.length - 1))
        return
      }
      if (ev.key === 'ArrowUp') {
        ev.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
        return
      }
      if (ev.key === 'Enter') {
        ev.preventDefault()
        const hit = hitsRef.current[selectedRef.current]
        if (hit) navigateTo(hit)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, navigateTo])

  // Keep the selected item scrolled into view.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('.kbar-item.sel') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, open])

  return (
    <div className={'kbar-scrim' + (open ? ' open' : '')} onClick={onClose} aria-hidden={!open}>
      <div
        className="kbar"
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kbar-input">
          <SearchIcon aria-hidden />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documentation…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="esc">esc</span>
        </div>
        <div className="kbar-results" ref={listRef}>
          {error && <div className="kbar-empty">Could not load search index: {error}</div>}
          {!error && hits.length === 0 && index && (
            <div className="kbar-empty">No results for &ldquo;{query}&rdquo;</div>
          )}
          {!error && !index && <div className="kbar-empty">Loading…</div>}
          {groups.map((group) => (
            <div key={group.key}>
              <div className="kbar-sec">{group.label}</div>
              {group.hits.map((hit) => {
                const idx = hits.indexOf(hit)
                return (
                  <ResultItem
                    key={hit.page.slug}
                    hit={hit}
                    selected={idx === selected}
                    onHover={() => setSelected(idx)}
                    onClick={() => navigateTo(hit)}
                  />
                )
              })}
            </div>
          ))}
        </div>
        <div className="kbar-foot">
          <span className="kk">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            navigate
          </span>
          <span className="kk">
            <kbd>↵</kbd>
            open
          </span>
          <span className="kk">
            <kbd>esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}

function groupHits(hits: SearchHit[]) {
  const order: Record<string, number> = { user: 0, dev: 1 }
  const map = new Map<string, { key: string; label: string; hits: SearchHit[] }>()
  for (const hit of hits) {
    const key = `${hit.page.tab}::${hit.page.group}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: `${hit.page.tabLabel} · ${hit.page.group}`,
        hits: []
      })
    }
    map.get(key)!.hits.push(hit)
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = a.key.split('::')[0]
    const tb = b.key.split('::')[0]
    return (order[ta] ?? 9) - (order[tb] ?? 9)
  })
}

function ResultItem({
  hit,
  selected,
  onHover,
  onClick
}: {
  hit: SearchHit
  selected: boolean
  onHover: () => void
  onClick: () => void
}) {
  return (
    <div
      className={'kbar-item' + (selected ? ' sel' : '')}
      onMouseEnter={onHover}
      onClick={onClick}
      role="option"
      aria-selected={selected}
    >
      <span className="ki">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      </span>
      <span className="kt">
        <b>{hit.page.title}</b>
        <span dangerouslySetInnerHTML={{ __html: hit.snippet }} />
      </span>
      <span className="kgo">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  )
}
