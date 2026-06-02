import type { ReactNode } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS } from '@/lib/sections'
import { LinuxIcon, MacIcon, WindowsIcon } from './Icons'

type Platform = { icon: ReactNode; label: string; sub: string }

const PLATFORMS: Platform[] = [
  { icon: <MacIcon />, label: 'macOS', sub: '.dmg · Apple Silicon & Intel' },
  { icon: <WindowsIcon />, label: 'Windows', sub: '.exe · x64 & ARM64' },
  { icon: <LinuxIcon />, label: 'Linux', sub: '.AppImage · .deb · .rpm' }
]

export default function Download() {
  return (
    <section className="block" id={SECTIONS.download}>
      <div className="wrap">
        <div className="cta reveal">
          <div className="cta-glow" />
          <span className="kicker kicker--center">Free download</span>
          <h2>
            Start writing in <span className="grad-text">two minutes</span>.
          </h2>
          <p>One download. No account, no subscription. Every desktop you write on.</p>
          <div className="platforms">
            {PLATFORMS.map((p) => (
              <a className="plat" key={p.label} href={DOWNLOAD.releases} {...EXT_LINK}>
                {p.icon}
                <div>
                  <b>{p.label}</b>
                  <span>{p.sub}</span>
                </div>
              </a>
            ))}
          </div>
          <div className="hero-note hero-note--cta">
            <span>
              Or install via Homebrew: <code className="inline">brew install --cask mark-text</code>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
