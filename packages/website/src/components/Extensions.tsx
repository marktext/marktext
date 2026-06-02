import type { ReactNode } from 'react'
import { SECTIONS, type RevealDelay } from '@/lib/sections'
import FeatureCard from './FeatureCard'
import {
  CodeIcon,
  DiagramIcon,
  FootnoteIcon,
  FrontmatterIcon,
  MathIcon,
  TableIcon
} from './Icons'

type Card = {
  icon: ReactNode
  title: string
  description: string
  mini: ReactNode
  delay?: RevealDelay
}

const CARDS: Card[] = [
  {
    icon: <TableIcon />,
    title: 'Tables',
    description: 'Build them visually, or pipe them in with Markdown.',
    mini: (
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
    )
  },
  {
    icon: <MathIcon />,
    title: 'Math & LaTeX',
    description: 'KaTeX inline and block math, rendered instantly.',
    delay: 'd1',
    mini: (
      <div className="katex">
        e<sup>iπ</sup> + 1 = 0&nbsp;&nbsp;·&nbsp;&nbsp;∫<sub>0</sub>
        <sup>∞</sup> x² dx
      </div>
    )
  },
  {
    icon: <DiagramIcon />,
    title: 'Diagrams',
    description: 'Flowcharts and charts via Mermaid, Vega & Vega-Lite.',
    delay: 'd2',
    mini: (
      <div className="mermaid-flow">
        <span className="node">Write</span>
        <span className="arrow">→</span>
        <span className="node">Render</span>
        <span className="arrow">→</span>
        <span className="node">Ship</span>
      </div>
    )
  },
  {
    icon: <FootnoteIcon />,
    title: 'Footnotes',
    description: 'Two-way reference footnotes that renumber themselves.',
    mini: (
      <>
        Drafted in 2024.
        <sup style={{ color: 'var(--accent)' }}>[1]</sup>
        <br />
        <span style={{ color: 'var(--muted)' }}>[1]: The year MarkText turned ten.</span>
      </>
    )
  },
  {
    icon: <CodeIcon />,
    title: 'Code blocks',
    description: 'Syntax highlighting for hundreds of languages.',
    delay: 'd1',
    mini: (
      <>
        <span className="c">{'// fib.js'}</span>
        <br />
        <span style={{ color: 'var(--a1)' }}>const</span> fib = n =&gt;
        <br />
        &nbsp;&nbsp;n &lt; 2 ? n : fib(n-1)+fib(n-2);
      </>
    )
  },
  {
    icon: <FrontmatterIcon />,
    title: 'Front matter',
    description: 'YAML, TOML and JSON metadata for blogs and static sites.',
    delay: 'd2',
    mini: (
      <>
        <span style={{ color: 'var(--muted)' }}>---</span>
        <br />
        <span style={{ color: 'var(--accent)' }}>title</span>: Hello World
        <br />
        <span style={{ color: 'var(--accent)' }}>tags</span>: [markdown, notes]
        <br />
        <span style={{ color: 'var(--muted)' }}>---</span>
      </>
    )
  }
]

export default function Extensions() {
  return (
    <section className="block" id={SECTIONS.extensions}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Markdown, extended</span>
          <h2 className="sec-title">More than CommonMark.</h2>
          <p className="sec-desc">
            Tables, math, diagrams, footnotes and front matter — all first-class, all rendered live.
          </p>
        </div>
        <div className="grid-3">
          {CARDS.map((c) => (
            <FeatureCard
              key={c.title}
              icon={c.icon}
              title={c.title}
              description={c.description}
              delay={c.delay}
            >
              <div className="mini">{c.mini}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </section>
  )
}
