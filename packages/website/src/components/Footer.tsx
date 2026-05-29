import { DOWNLOAD } from '@/lib/downloads'
import { GitHubIcon } from './Icons'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <a className="brand" href="#top">
              <img className="mark" src="/assets/logo.png" alt="MarkText logo" />
              MarkText
            </a>
            <p>
              A simple, elegant open-source Markdown editor. Made by the community, free forever.
            </p>
          </div>
          <div className="foot-col">
            <h5>Product</h5>
            <a href="#preview">Real-time preview</a>
            <a href="#themes">Themes</a>
            <a href="#extensions">Markdown support</a>
            <a href="#download">Download</a>
            <a href="#support">Support the project</a>
          </div>
          <div className="foot-col">
            <h5>Resources</h5>
            <a href={DOWNLOAD.repo} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            <a href={DOWNLOAD.releases} target="_blank" rel="noopener noreferrer">
              Releases
            </a>
            <a href={DOWNLOAD.contributing} target="_blank" rel="noopener noreferrer">
              Contributing
            </a>
            <a href={DOWNLOAD.issues} target="_blank" rel="noopener noreferrer">
              Issues
            </a>
          </div>
          <div className="foot-col">
            <h5>Community</h5>
            <a href={DOWNLOAD.repo} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={DOWNLOAD.twitter} target="_blank" rel="noopener noreferrer">
              Twitter / X
            </a>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2017–2026 MarkText · Released under the MIT License</span>
          <div className="foot-social">
            <a
              className="icon-btn"
              href={DOWNLOAD.repo}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <GitHubIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
