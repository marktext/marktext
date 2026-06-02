import Link from 'next/link'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS, hash } from '@/lib/sections'
import Brand from './Brand'
import { GitHubIcon } from './Icons'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <Brand />
            <p>
              A simple, elegant open-source Markdown editor. Made by the community, free forever.
            </p>
          </div>
          <div className="foot-col">
            <h5>Product</h5>
            <a href={hash(SECTIONS.preview)}>Real-time preview</a>
            <a href={hash(SECTIONS.themes)}>Themes</a>
            <a href={hash(SECTIONS.extensions)}>Markdown support</a>
            <a href={hash(SECTIONS.download)}>Download</a>
            <a href={hash(SECTIONS.support)}>Support the project</a>
          </div>
          <div className="foot-col">
            <h5>Resources</h5>
            <Link href="/docs">Documentation</Link>
            <a href={DOWNLOAD.releases} {...EXT_LINK}>Releases</a>
            <a href={DOWNLOAD.contributing} {...EXT_LINK}>Contributing</a>
            <a href={DOWNLOAD.issues} {...EXT_LINK}>Issues</a>
          </div>
          <div className="foot-col">
            <h5>Community</h5>
            <a href={DOWNLOAD.repo} {...EXT_LINK}>GitHub</a>
            <a href={DOWNLOAD.twitter} {...EXT_LINK}>Twitter / X</a>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2017–2026 MarkText · Released under the MIT License</span>
          <div className="foot-social">
            <a className="icon-btn" href={DOWNLOAD.repo} {...EXT_LINK} aria-label="GitHub">
              <GitHubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
