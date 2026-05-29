import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ALL_PAGES,
  findPageBySlug,
  firstPageOfTab,
  neighborsFor
} from '@/lib/docs-nav'
import { readDoc, renderMarkdown } from '@/lib/markdown'
import DocsSidebar from '@/components/docs/DocsSidebar'
import DocsToc from '@/components/docs/DocsToc'
import Pager from '@/components/docs/Pager'
import SidebarToggle from '@/components/docs/SidebarToggle'
import { DOWNLOAD } from '@/lib/downloads'

export const dynamicParams = false
export const dynamic = 'force-static'

export function generateStaticParams() {
  return ALL_PAGES.map((p) => ({ slug: p.slug }))
}

type Params = { slug: string[] }

export async function generateMetadata({
  params
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const page = findPageBySlug(slug)
  if (!page) return {}
  return {
    title: page.title,
    description: page.hint
  }
}

export default async function DocPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const page = findPageBySlug(slug)
  if (!page) notFound()

  const source = await readDoc(page.file)
  const { html, toc, title, lead } = await renderMarkdown(source, page.file)
  const { prev, next } = neighborsFor(page.slug)
  const fallbackTab = firstPageOfTab(page.tab)

  const editHref =
    DOWNLOAD.repo + '/edit/develop/packages/website/content/docs/' + page.file

  return (
    <div className="docs-shell">
      <DocsSidebar activeTab={page.tab} activeHref={page.href} />
      <main className="doc-main">
        <SidebarToggle />
        <article className="doc-article">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href={fallbackTab.href}>{page.tabLabel}</Link>
            <span className="sep">/</span>
            <span className="cur">{page.group}</span>
            <span className="sep">/</span>
            <span className="cur">{page.title}</span>
          </nav>
          <div className="doc-eyebrow">
            {page.tab === 'user' ? 'User documentation' : 'Developer documentation'}
          </div>
          <h1 className="art-title">{title ?? page.title}</h1>
          {lead && <p className="art-lead">{lead}</p>}
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
          <Pager prev={prev} next={next} />
          <footer className="doc-footer">
            <span>
              Last reviewed in the develop branch · open source under the MIT license.
            </span>
            <a className="edit-link" href={editHref} target="_blank" rel="noopener noreferrer">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
              Edit this page on GitHub
            </a>
          </footer>
        </article>
      </main>
      <DocsToc entries={toc} />
    </div>
  )
}
