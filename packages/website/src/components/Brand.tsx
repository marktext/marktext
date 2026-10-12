import { SECTIONS, hash } from '@/lib/sections'

export default function Brand({ home = true }: { home?: boolean }) {
  return (
    <a className="brand" href={(home ? '' : '/') + hash(SECTIONS.top)}>
      <img className="mark" src="/assets/logo.png" alt="MarkText logo" width={28} height={28} />
      MarkText
    </a>
  )
}
