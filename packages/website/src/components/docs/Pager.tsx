import Link from 'next/link'
import type { DocPageWithCtx } from '@/lib/docs-nav'

type Props = {
  prev: DocPageWithCtx | null
  next: DocPageWithCtx | null
}

export default function Pager({ prev, next }: Props) {
  if (!prev && !next) return null
  return (
    <nav className="pager" aria-label="Previous / next page">
      {prev ? (
        <Link className="prev" href={prev.href}>
          <span className="dir">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Previous
          </span>
          <span className="nm">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className="next" href={next.href}>
          <span className="dir">
            Next
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
          <span className="nm">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
