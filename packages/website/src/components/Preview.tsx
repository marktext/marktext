import { SECTIONS } from '@/lib/sections'
import FeatItem from './FeatItem'
import MockWindow from './MockWindow'
import { BoltIcon, GridSmallIcon, LinesIcon } from './Icons'

export default function Preview() {
  return (
    <section className="block" id={SECTIONS.preview}>
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
              <FeatItem
                delay="d1"
                icon={<BoltIcon />}
                title="Render in place"
                description={
                  <>
                    Type <code className="inline">## Heading</code> and watch the markup melt away.
                  </>
                }
              />
              <FeatItem
                delay="d2"
                icon={<LinesIcon />}
                title="Source code mode"
                description="Drop into raw Markdown anytime you need full control."
              />
              <FeatItem
                delay="d3"
                icon={<GridSmallIcon />}
                title="Paste & go"
                description="Paste rich text and MarkText converts it to clean Markdown."
              />
            </div>
          </div>
          <div className="reveal d2">
            <MockWindow title="typing.md" docStyle={{ minHeight: 320 }}>
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
            </MockWindow>
          </div>
        </div>
      </div>
    </section>
  )
}
