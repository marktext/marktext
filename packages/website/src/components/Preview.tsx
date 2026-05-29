import { BoltIcon, GridSmallIcon, LinesIcon } from './Icons'

export default function Preview() {
  return (
    <section className="block" id="preview">
      <div className="wrap">
        <div className="split">
          <div className="split-text">
            <div className="sec-head reveal">
              <span className="kicker">Real-time preview</span>
              <h2 className="sec-title">See it as you mean it.</h2>
              <p className="sec-desc">
                A true WYSIWYG editor — your Markdown transforms in place the moment you type. No
                split view, no toggling.
              </p>
            </div>
            <div className="feat-list">
              <div className="feat-item reveal d1">
                <div className="ic">
                  <BoltIcon />
                </div>
                <div>
                  <h4>Render in place</h4>
                  <p>
                    Type <code className="inline">## Heading</code> and watch the markup melt away.
                  </p>
                </div>
              </div>
              <div className="feat-item reveal d2">
                <div className="ic">
                  <LinesIcon />
                </div>
                <div>
                  <h4>Source code mode</h4>
                  <p>Drop into raw Markdown anytime you need full control.</p>
                </div>
              </div>
              <div className="feat-item reveal d3">
                <div className="ic">
                  <GridSmallIcon />
                </div>
                <div>
                  <h4>Paste &amp; go</h4>
                  <p>Paste rich text and MarkText converts it to clean Markdown.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="reveal d2">
            <div className="window">
              <div className="win-bar">
                <div className="traffic">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="win-title">
                  <span className="dot" /> typing.md
                </div>
              </div>
              <div className="doc" style={{ minHeight: 320 }}>
                <h2 style={{ marginTop: 0 }}>As you type</h2>
                <p>
                  <span className="synt">**</span>
                  <strong>Bold</strong>
                  <span className="synt">**</span> snaps bold, <span className="synt">_</span>
                  <em>italics</em>
                  <span className="synt">_</span> lean, and links become{' '}
                  <a className="link" href="#">
                    clickable
                  </a>{' '}
                  the instant you finish them.
                </p>
                <p>Lists build themselves:</p>
                <ul>
                  <li>One keystroke per bullet</li>
                  <li>Nesting just works</li>
                  <li>
                    Checkboxes too <span className="cursor" />
                  </li>
                </ul>
                <blockquote>Stay in flow — never touch a render button again.</blockquote>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
