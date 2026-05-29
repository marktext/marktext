import {
  CodeIcon,
  DiagramIcon,
  FootnoteIcon,
  FrontmatterIcon,
  MathIcon,
  TableIcon
} from './Icons'

export default function Extensions() {
  return (
    <section className="block" id="extensions">
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Markdown, extended</span>
          <h2 className="sec-title">More than CommonMark.</h2>
          <p className="sec-desc">
            Tables, math, diagrams, footnotes and front matter — all first-class, all rendered live.
          </p>
        </div>
        <div className="grid-3">
          <div className="card reveal">
            <div className="ic-lg">
              <TableIcon />
            </div>
            <h3>Tables</h3>
            <p>Build them visually, or pipe them in with Markdown.</p>
            <div className="mini">
              <div className="tbl">
                <span className="h">Feature</span>
                <span className="h">Free</span>
                <span className="h">Pro</span>
                <span>Preview</span>
                <span>✓</span>
                <span>✓</span>
                <span>Themes</span>
                <span>✓</span>
                <span>✓</span>
              </div>
            </div>
          </div>

          <div className="card reveal d1">
            <div className="ic-lg">
              <MathIcon />
            </div>
            <h3>Math &amp; LaTeX</h3>
            <p>KaTeX inline and block math, rendered instantly.</p>
            <div className="mini">
              <div className="katex">
                e<sup>iπ</sup> + 1 = 0&nbsp;&nbsp;·&nbsp;&nbsp;∫<sub>0</sub>
                <sup>∞</sup> x² dx
              </div>
            </div>
          </div>

          <div className="card reveal d2">
            <div className="ic-lg">
              <DiagramIcon />
            </div>
            <h3>Diagrams</h3>
            <p>Flowcharts and charts via Mermaid, Vega &amp; Vega-Lite.</p>
            <div className="mini">
              <div className="mermaid-flow">
                <span className="node">Write</span>
                <span className="arrow">→</span>
                <span className="node">Render</span>
                <span className="arrow">→</span>
                <span className="node">Ship</span>
              </div>
            </div>
          </div>

          <div className="card reveal">
            <div className="ic-lg">
              <FootnoteIcon />
            </div>
            <h3>Footnotes</h3>
            <p>Two-way reference footnotes that renumber themselves.</p>
            <div className="mini">
              Drafted in 2024.
              <sup style={{ color: 'var(--accent)' }}>[1]</sup>
              <br />
              <span style={{ color: 'var(--muted)' }}>[1]: The year MarkText turned ten.</span>
            </div>
          </div>

          <div className="card reveal d1">
            <div className="ic-lg">
              <CodeIcon />
            </div>
            <h3>Code blocks</h3>
            <p>Syntax highlighting for hundreds of languages.</p>
            <div className="mini">
              <span className="c">{'// fib.js'}</span>
              <br />
              <span style={{ color: 'var(--a1)' }}>const</span> fib = n =&gt;
              <br />
              &nbsp;&nbsp;n &lt; 2 ? n : fib(n-1)+fib(n-2);
            </div>
          </div>

          <div className="card reveal d2">
            <div className="ic-lg">
              <FrontmatterIcon />
            </div>
            <h3>Front matter</h3>
            <p>YAML, TOML and JSON metadata for blogs and static sites.</p>
            <div className="mini">
              <span style={{ color: 'var(--muted)' }}>---</span>
              <br />
              <span style={{ color: 'var(--accent)' }}>title</span>: Hello World
              <br />
              <span style={{ color: 'var(--accent)' }}>tags</span>: [markdown, notes]
              <br />
              <span style={{ color: 'var(--muted)' }}>---</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
