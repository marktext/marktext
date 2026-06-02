'use client'

import { useRef } from 'react'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { revealClass } from '@/lib/sections'
import { useTilt } from '@/hooks/useTilt'
import MockWindow from './MockWindow'
import { CheckIcon, DownloadIcon, GitHubIcon } from './Icons'

export default function Hero() {
  const stageRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLDivElement>(null)
  useTilt(stageRef, winRef)

  return (
    <header className="hero">
      <div className="wrap">
        <div className={revealClass(undefined, 'eyebrow')}>
          <span className="tag">v0.19.0</span> Free &amp; open source forever
        </div>
        <h1 className={revealClass('d1', 'hero-title')}>
          Write in Markdown. <span className="grad-text">Stay in flow.</span>
        </h1>
        <p className={revealClass('d2', 'hero-sub')}>
          Realtime preview, beautiful typography, and zero distractions.
        </p>
        <div className={revealClass('d3', 'hero-cta')}>
          <a className="btn btn-primary btn-lg" href={DOWNLOAD.releases} {...EXT_LINK}>
            <DownloadIcon />
            Download for free
          </a>
          <a className="btn btn-ghost btn-lg" href={DOWNLOAD.repo} {...EXT_LINK}>
            <GitHubIcon />
            Star on GitHub
          </a>
        </div>
        <div className={revealClass('d4', 'hero-note')}>
          <span>
            <CheckIcon /> macOS · Windows · Linux
          </span>
          <span>
            <CheckIcon /> No account, no tracking
          </span>
          <span>
            <CheckIcon /> 56k+ stars on GitHub
          </span>
        </div>

        <div className={revealClass('d2', 'stage')} id="stage" ref={stageRef}>
          <div className="stage-glow" />
          <MockWindow title="product-launch.md" showActions windowId="heroWin" windowRef={winRef}>
            <h1>
              Shipping Notes <span className="cursor" />
            </h1>
            <p className="doc-sub">A living document, written entirely in Markdown.</p>
            <p className="lead">
              MarkText renders your formatting <strong>as you type</strong> — headings grow, <em>emphasis</em> leans, and{' '}
              <code className="inline">code</code> snaps into place without ever leaving the page.
            </p>
            <h2>What changed</h2>
            <ul>
              <li>Seamless real-time rendering with no preview pane</li>
              <li>33 built-in themes plus full custom CSS</li>
              <li>Tables, math, footnotes &amp; diagrams out of the box</li>
            </ul>
            <blockquote>“The best Markdown editors disappear. MarkText disappears beautifully.”</blockquote>
            <pre>
              <span className="c">{'# export.sh'}</span>
              {'\n'}
              <span className="k">marktext</span> notes.md <span className="f">--export</span>{' '}
              <span className="s">pdf</span>
            </pre>
          </MockWindow>
        </div>
      </div>
    </header>
  )
}
