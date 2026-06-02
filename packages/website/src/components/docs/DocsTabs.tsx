import Link from 'next/link'
import type { DocTabId } from '@/lib/docs-nav'
import { DOC_TABS, firstPageOfTab } from '@/lib/docs-nav'

type Props = {
  activeTab: DocTabId
}

const TAB_ICONS: Record<DocTabId, React.ReactNode> = {
  user: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  dev: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m8 16-4-4 4-4M16 8l4 4-4 4M14.5 4l-5 16" />
    </svg>
  )
}

export default function DocsTabs({ activeTab }: Props) {
  return (
    <div className="doctabs">
      <div className="doctabs-in">
        {DOC_TABS.map((tab) => {
          const target = firstPageOfTab(tab.id)
          return (
            <Link
              key={tab.id}
              className={'doctab' + (activeTab === tab.id ? ' active' : '')}
              href={target.href}
            >
              {TAB_ICONS[tab.id]}
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
