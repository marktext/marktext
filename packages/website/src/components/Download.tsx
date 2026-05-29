import { DOWNLOAD } from '@/lib/downloads'
import { SECTIONS } from '@/lib/sections'
import { LinuxIcon, MacIcon, WindowsIcon } from './Icons'

export default function Download() {
  return (
    <section className="block" id={SECTIONS.download.slice(1)}>
      <div className="wrap">
        <div className="cta reveal">
          <div className="cta-glow" />
          <span className="kicker" style={{ justifyContent: 'center' }}>
            Free download
          </span>
          <h2>
            Start writing in <span className="grad-text">two minutes</span>.
          </h2>
          <p>One download. No account, no subscription. Every desktop you write on.</p>
          <div className="platforms">
            <a className="plat" href={DOWNLOAD.mac} target="_blank" rel="noopener noreferrer">
              <MacIcon />
              <div>
                <b>macOS</b>
                <span>.dmg · Apple Silicon &amp; Intel</span>
              </div>
            </a>
            <a className="plat" href={DOWNLOAD.windows} target="_blank" rel="noopener noreferrer">
              <WindowsIcon />
              <div>
                <b>Windows</b>
                <span>.exe · x64 &amp; ARM64</span>
              </div>
            </a>
            <a className="plat" href={DOWNLOAD.linux} target="_blank" rel="noopener noreferrer">
              <LinuxIcon />
              <div>
                <b>Linux</b>
                <span>.AppImage · .deb · .rpm</span>
              </div>
            </a>
          </div>
          <div className="hero-note" style={{ marginTop: 24 }}>
            <span>
              Or install via Homebrew: <code className="inline">brew install --cask mark-text</code>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
