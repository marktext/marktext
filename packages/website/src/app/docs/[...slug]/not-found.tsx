import Link from 'next/link'
import { firstPageOfTab } from '@/lib/docs-nav'

export default function NotFound() {
  const first = firstPageOfTab('user')
  return (
    <main className="doc-main doc-notfound">
      <article className="doc-article">
        <div className="doc-eyebrow">404</div>
        <h1 className="art-title">Page not found</h1>
        <p className="art-lead">
          The page you&apos;re looking for has moved or never existed. Try the documentation
          home, or press <code className="inline">⌘K</code> to search.
        </p>
        <p>
          <Link className="doc-cta" href={first.href}>
            Back to {first.title}
          </Link>
        </p>
      </article>
    </main>
  )
}
