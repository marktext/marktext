import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'vue/compiler-sfc'

// #4997: icon-only controls had no accessible name (a `title` at best), and
// keyboard focus on them was invisible because of the global `:focus` reset.
// These checks read the real templates and theme files, so a new icon button
// without an `aria-label`, or a theme whose focus ring fades into the
// background, fails here rather than in a screen reader.

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER = resolve(__dirname, '../../../src/renderer/src')

// Node kinds from @vue/compiler-core's NodeTypes, which compiler-sfc does not
// re-export.
const ELEMENT = 1
const TEXT = 2
const INTERPOLATION = 5
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
  content?: string
  props?: TemplateProp[]
  children?: TemplateNode[]
  loc: { start: { line: number } }
}

const listVueFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory()) return listVueFiles(full)
    return entry.name.endsWith('.vue') ? [full] : []
  })

const elementsOf = (file: string): TemplateNode[] => {
  const ast = parse(readFileSync(file, 'utf8')).descriptor.template?.ast as
    | TemplateNode
    | undefined
  const out: TemplateNode[] = []
  const visit = (node: TemplateNode): void => {
    if (node.type === ELEMENT) out.push(node)
    node.children?.forEach(visit)
  }
  if (ast) visit(ast)
  return out
}

const attr = (el: TemplateNode, name: string): string | null => {
  for (const p of el.props ?? []) {
    if (p.type === ATTRIBUTE && p.name === name) return p.value?.content ?? ''
    if (p.type === DIRECTIVE && p.name === 'bind' && p.arg?.content === name) {
      return p.exp?.content ?? ''
    }
  }
  return null
}

const hasText = (node: TemplateNode): boolean => {
  if (node.type === TEXT) return (node.content ?? '').trim() !== ''
  if (node.type === INTERPOLATION) return true
  return (node.children ?? []).some(hasText)
}

const where = (file: string, el: TemplateNode): string =>
  `${relative(RENDERER, file)}:${el.loc.start.line} <${el.tag}>`

const vueFiles = listVueFiles(RENDERER)

describe('icon-only controls have an accessible name (#4997)', () => {
  it('found the renderer templates', () => {
    expect(vueFiles.length).toBeGreaterThan(30)
  })

  it('every button without text content carries an aria-label', () => {
    const unnamed: string[] = []
    for (const file of vueFiles) {
      for (const el of elementsOf(file)) {
        if (el.tag !== 'button' && el.tag !== 'el-button') continue
        if (attr(el, 'aria-hidden') === 'true') continue
        if (hasText(el) || attr(el, 'aria-label') || attr(el, 'aria-labelledby')) continue
        unnamed.push(where(file, el))
      }
    }
    expect(unnamed, `\n  ${unnamed.join('\n  ')}\n`).toEqual([])
  })

  it('each icon tooltip wraps one control named with the tooltip text', () => {
    const mismatched: string[] = []
    for (const file of vueFiles) {
      for (const el of elementsOf(file)) {
        if (el.tag !== 'icon-tooltip') continue
        const children = (el.children ?? []).filter((c) => c.type === ELEMENT)
        const content = attr(el, 'content')
        let control = children.length === 1 ? children[0] : undefined
        if (control?.tag === 'span') {
          const nested = (control.children ?? []).filter(c => c.type === ELEMENT)
          control = nested.length === 1 && ['button', 'el-button'].includes(nested[0].tag ?? '') ? nested[0] : undefined
        }
        const label = control ? attr(control, 'aria-label') : null
        if (!content || label !== content) mismatched.push(where(file, el))
      }
    }
    expect(mismatched, `\n  ${mismatched.join('\n  ')}\n`).toEqual([])
  })

  // el-tooltip overwrites these on its trigger, so the state would never reach
  // assistive tech.
  it('no icon tooltip wraps a control that relies on popup or expanded state', () => {
    const clobbered: string[] = []
    for (const file of vueFiles) {
      for (const el of elementsOf(file)) {
        if (el.tag !== 'icon-tooltip') continue
        for (const child of (el.children ?? []).filter((c) => c.type === ELEMENT)) {
          for (const name of ['aria-expanded', 'aria-haspopup', 'aria-controls']) {
            if (attr(child, name) !== null) clobbered.push(`${where(file, child)} ${name}`)
          }
        }
      }
    }
    expect(clobbered, `\n  ${clobbered.join('\n  ')}\n`).toEqual([])
  })
})

type Rgb = [number, number, number]
type Rgba = [number, number, number, number]

const THEME_DIR = resolve(RENDERER, 'assets/themes')
const BASE_CSS = readFileSync(resolve(RENDERER, 'assets/styles/index.css'), 'utf8')

const parseVars = (css: string): Record<string, string> => {
  const vars: Record<string, string> = {}
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim()
  return vars
}

const resolveColor = (name: string, vars: Record<string, string>): Rgba => {
  let value = `var(${name})`
  for (let i = 0; i < 20 && value.includes('var('); i++) {
    value = value.replace(/var\(\s*(--[\w-]+)\s*(?:,[^)]*)?\)/g, (_, v) => vars[v] ?? '').trim()
  }
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as Rgba
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)/)
  if (rgb) {
    const [r, g, b, a = 1] = rgb[1].split(',').map((s) => parseFloat(s))
    return [r, g, b, a]
  }
  throw new Error(`cannot resolve ${name} (got "${value}")`)
}

const over = ([r, g, b, a]: Rgba, bg: Rgb): Rgb => [
  r * a + bg[0] * (1 - a),
  g * a + bg[1] * (1 - a),
  b * a + bg[2] * (1 - a)
]

const luminance = (rgb: Rgb): number => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const ringVar = (): string => {
  const rule = BASE_CSS.match(/\.plain-button:focus-visible\s*\{([^}]*)\}/)
  const color = rule?.[1].match(/outline:[^;]*var\((--[\w-]+)\)/)
  if (!color) throw new Error('no .plain-button:focus-visible outline colour in index.css')
  return color[1]
}

// Surfaces the plain buttons sit on: the side bar, the title bar and tab
// strip over the editor, and the find bar.
const SURFACES = ['--sideBarBgColor', '--editorBgColor', '--floatBgColor']

describe('focus ring meets WCAG 1.4.11 non-text contrast (#4997)', () => {
  const baseVars = parseVars(BASE_CSS)
  const themes: Array<[string, Record<string, string>]> = [
    ['light (default)', baseVars],
    ...readdirSync(THEME_DIR)
      .filter((f) => f.endsWith('.theme.css'))
      .map((f): [string, Record<string, string>] => [
        f.replace('.theme.css', ''),
        { ...baseVars, ...parseVars(readFileSync(resolve(THEME_DIR, f), 'utf8')) }
      ])
  ]

  it('found the bundled themes', () => {
    expect(themes.length).toBeGreaterThan(20)
  })

  it('the ring is at least 3:1 against every surface in every theme', () => {
    const ring = ringVar()
    const failures: string[] = []
    for (const [theme, vars] of themes) {
      const editor = resolveColor('--editorBgColor', vars)
      const editorRgb = over(editor, [255, 255, 255])
      for (const surfaceVar of SURFACES) {
        const surface = over(resolveColor(surfaceVar, vars), editorRgb)
        const ratio = contrast(over(resolveColor(ring, vars), surface), surface)
        if (ratio < 3) failures.push(`${theme}: ${ring} on ${surfaceVar} is ${ratio.toFixed(2)}:1`)
      }
    }
    expect(failures, `\n  ${failures.join('\n  ')}\n`).toEqual([])
  })
})
