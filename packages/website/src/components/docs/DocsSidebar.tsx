'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { DocTab, DocTabId } from '@/lib/docs-nav'
import { DOC_TABS } from '@/lib/docs-nav'
import { DOWNLOAD } from '@/lib/downloads'
import { GitHubIcon } from '@/components/Icons'

const STORAGE_KEY = 'marktext-doc-groups'

type Props = {
  activeTab: DocTabId
  activeHref: string
  onNavigate?: () => void
}

export default function DocsSidebar({ activeTab, activeHref, onNavigate }: Props) {
  const tab = DOC_TABS.find((t) => t.id === activeTab) ?? DOC_TABS[0]
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setCollapsed(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside className="doc-side" id="docSide">
      <TabPane
        tab={tab}
        collapsed={collapsed}
        toggleGroup={toggleGroup}
        activeHref={activeHref}
        onNavigate={onNavigate}
      />
      <div className="side-foot">
        <a
          href={DOWNLOAD.repo + '/tree/develop/packages/website/content/docs'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <GitHubIcon aria-hidden />
          Docs on GitHub
        </a>
        <a href={DOWNLOAD.issues} target="_blank" rel="noopener noreferrer">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Report an issue
        </a>
      </div>
    </aside>
  )
}

function TabPane({
  tab,
  collapsed,
  toggleGroup,
  activeHref,
  onNavigate
}: {
  tab: DocTab
  collapsed: Record<string, boolean>
  toggleGroup: (k: string) => void
  activeHref: string
  onNavigate?: () => void
}) {
  return (
    <div className="tab-pane">
      {tab.groups.map((group) => {
        const key = `${tab.id}::${group.label}`
        const isCollapsed = !!collapsed[key]
        return (
          <SideGroup
            key={key}
            label={group.label}
            collapsed={isCollapsed}
            onToggle={() => toggleGroup(key)}
          >
            {group.pages.map((page) => {
              const href = '/docs/' + page.slug.join('/')
              const active = href === activeHref
              return (
                <Link
                  key={href}
                  href={href}
                  className={'side-link' + (active ? ' active' : '')}
                  onClick={onNavigate}
                >
                  {page.title}
                </Link>
              )
            })}
          </SideGroup>
        )
      })}
    </div>
  )
}

function SideGroup({
  label,
  collapsed,
  onToggle,
  children
}: {
  label: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const [maxHeight, setMaxHeight] = useState<string | undefined>(undefined)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    if (collapsed) {
      setMaxHeight(el.scrollHeight + 'px')
      requestAnimationFrame(() => setMaxHeight('0px'))
    } else {
      setMaxHeight(el.scrollHeight + 'px')
      const timer = window.setTimeout(() => setMaxHeight(undefined), 320)
      return () => window.clearTimeout(timer)
    }
  }, [collapsed])

  return (
    <div className={'side-group' + (collapsed ? ' collapsed' : '')}>
      <button type="button" className="side-label" onClick={onToggle}>
        {label}
        <svg
          className="chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        className="side-list"
        ref={listRef}
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
