import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'vue/compiler-sfc'

// #5828: the title-bar window controls (minimize/maximize/close) are only
// visible in dark themes when a theme rule recolours their SVG. That rule was
// written against the wrapper the buttons had before #5739 turned the icon
// containers from `<div>` into `<span>`, so every theme rule stopped matching
// and the icons fell back to the base `fill: #000000`, invisible on a dark bar.
//
// The same issue also reported the word/character count sitting flush against
// the application-menu button: `.left-toolbar` is a flex row without a gap.
//
// Both checks read the real template and theme files, so the next time the
// wrapper element or the toolbar layout changes, the mismatch fails here
// instead of shipping as invisible icons.

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER = resolve(__dirname, '../../../src/renderer/src')
const THEME_DIR = resolve(RENDERER, 'assets/themes')
const TITLE_BAR = resolve(RENDERER, 'components/titleBar/index.vue')

// Node kinds from @vue/compiler-core's NodeTypes, which compiler-sfc does not
// re-export.
const ELEMENT = 1
const ATTRIBUTE = 6
const DIRECTIVE = 7

interface TemplateProp {
  type: number
  name: string
  value?: { content: string }
  arg?: { content: string }
  exp?: { content: string }
}

interface TemplateNode {
  type: number
  tag?: string
  props?: TemplateProp[]
  children?: TemplateNode[]
  loc: { start: { line: number } }
}

const source = readFileSync(TITLE_BAR, 'utf8')
const descriptor = parse(source).descriptor
const templateAst = descriptor.template?.ast as TemplateNode | undefined

const attr = (el: TemplateNode, name: string): string | null => {
  for (const p of el.props ?? []) {
    if (p.type === ATTRIBUTE && p.name === name) return p.value?.content ?? ''
    if (p.type === DIRECTIVE && p.name === 'bind' && p.arg?.content === name) {
      return p.exp?.content ?? ''
    }
  }
  return null
}

const elementsOf = (root: TemplateNode | undefined): TemplateNode[] => {
  const out: TemplateNode[] = []
  const visit = (node: TemplateNode): void => {
    if (node.type === ELEMENT) out.push(node)
    node.children?.forEach(visit)
  }
  if (root) visit(root)
  return out
}

// The tag of the element that wraps the SVG inside a window-control button.
const iconWrapperTag = (): { tag: string; line: number } => {
  const button = elementsOf(templateAst).find(
    (el) => el.tag === 'button' && (attr(el, 'class') ?? '').includes('frameless-titlebar-button')
  )
  if (!button) throw new Error('no .frameless-titlebar-button in the title bar template')
  const wrapper = (button.children ?? []).find((child) => child.type === ELEMENT)
  if (!wrapper?.tag) throw new Error('window-control button has no element wrapper')
  return { tag: wrapper.tag, line: button.loc.start.line }
}

const themeFiles = readdirSync(THEME_DIR).filter((file) => file.endsWith('.theme.css'))

const controlIconRules = (css: string): Array<{ tag: string; body: string }> => {
  const rules: Array<{ tag: string; body: string }> = []
  const re = /\.title-bar\s+\.frameless-titlebar-button\s*>\s*([\w-]+)\s*>\s*svg\s*\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) rules.push({ tag: m[1], body: m[2] })
  return rules
}

const leftToolbarBlock = (): string => {
  const m = source.match(/\.left-toolbar\s*\{([^}]*)\}/)
  if (!m) throw new Error('no .left-toolbar rule in the title bar component')
  return m[1]
}

describe('title-bar controls follow the theme (#5828)', () => {
  it('found the window-control icon wrapper and the theme files', () => {
    expect(templateAst).toBeTruthy()
    expect(iconWrapperTag().tag).toBeTruthy()
    expect(themeFiles.length).toBeGreaterThan(20)
  })

  it('every theme recolours the icon through the element the template actually renders', () => {
    const { tag, line } = iconWrapperTag()
    const failures: string[] = []

    for (const file of themeFiles) {
      const rules = controlIconRules(readFileSync(resolve(THEME_DIR, file), 'utf8'))
      for (const rule of rules) {
        if (rule.tag !== tag) {
          failures.push(
            `${file}: rule targets > ${rule.tag} > svg but the button renders > ${tag} > svg (template line ${line})`
          )
        }
        if (!/fill\s*:/.test(rule.body)) {
          failures.push(`${file}: rule does not set fill`)
        }
      }
    }

    expect(failures, `\n  ${failures.join('\n  ')}\n`).toEqual([])
  })

  it('keeps the per-theme override on the majority of themes', () => {
    // The two light themes without the rule (graphite, ulysses) inherit the
    // base black fill; the dark ones must keep overriding it.
    const withRules = themeFiles.filter(
      (file) => controlIconRules(readFileSync(resolve(THEME_DIR, file), 'utf8')).length > 0
    )
    expect(withRules.length).toBeGreaterThan(20)
  })

  it('separates the application menu from the document statistics', () => {
    const gap = leftToolbarBlock().match(/(?<![-\w])gap\s*:\s*([^;]+);/)
    expect(gap, '.left-toolbar needs a gap so the menu and statistics do not touch').toBeTruthy()
    if (!gap) return
    expect(parseFloat(gap[1])).toBeGreaterThan(0)
  })
})
