'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { TocEntry } from '@/lib/markdown'

type Props = {
  entries: TocEntry[]
}

export default function DocsToc({ entries }: Props) {
  const [activeId, setActiveId] = useState<string | null>(entries[0]?.id ?? null)

  useEffect(() => {
    if (entries.length === 0) return
    const ids = entries.map((e) => e.id)
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      {
        rootMargin: '-130px 0px -65% 0px',
        threshold: [0, 1]
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [entries])

  return (
    <aside className="doc-toc">
      {entries.length > 0 && (
        <>
          <div className="toc-head">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 6h13M9 12h13M9 18h13M5 6h.01M5 12h.01M5 18h.01" />
            </svg>
            On this page
          </div>
          <nav className="toc-list">
            {entries.map((entry) => (
              <a
                key={entry.id}
                href={'#' + entry.id}
                className={
                  (entry.depth === 3 ? 'sub' : '') +
                  (activeId === entry.id ? ' active' : '')
                }
              >
                {entry.text}
              </a>
            ))}
          </nav>
        </>
      )}
      <div className="toc-aside">
        <b>Try it yourself</b>
        <p>
          The fastest way to learn MarkText is to write in it. It&apos;s free and open source,
          forever.
        </p>
        <Link className="mini-btn" href="/#download">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
          </svg>
          Download
        </Link>
      </div>
    </aside>
  )
}
