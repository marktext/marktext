'use client'

import { revealClass, type RevealDelay } from '@/lib/sections'
import { useProjectInfo } from './ProjectInfoProvider'

type Stat = { value: string; label: string; delay?: RevealDelay }

export default function Stats() {
  const { githubStars, contributors } = useProjectInfo()
  const stats: Stat[] = [
    { value: githubStars?.toLocaleString('en-US') ?? '—', label: 'GitHub stars' },
    { value: contributors?.toLocaleString('en-US') ?? '—', label: 'Contributors', delay: 'd1' },
    { value: '3', label: 'Platforms supported', delay: 'd2' },
    { value: 'MIT', label: 'Free & open source', delay: 'd3' }
  ]
  return (
    <section className="block block--top-tight">
      <div className="wrap">
        <div className="stats">
          {stats.map((s) => (
            <div className={revealClass(s.delay, 'stat')} key={s.label}>
              <div className="n grad-text">{s.value}</div>
              <div className="l">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
