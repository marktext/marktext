import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; join?: (...parts: string[]) => string }
      DIRNAME?: string
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', join: (...parts: string[]) => parts.join('/') }
  w.window.DIRNAME = '/docs'
})

import { Muya } from '@muyajs/core'
import { exportStyledHTML } from '@/util/exportHtml'
import { getHtmlToc } from '@/util/pdf'

const hosts: HTMLElement[] = []

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove()
})

const exportWithToc = async(markdown: string): Promise<string> => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1])
  muya.init()
  hosts.push(muya.domNode)

  const toc = getHtmlToc(muya.getTOC(), {})
  return exportStyledHTML(muya, muya.getMarkdown(), { toc })
}

const tocLinks = (html: string): string[] => {
  const list = /<ul class="toc-list">([\s\S]*?)<\/ul><\/div>/.exec(html)?.[1] ?? ''
  return [...list.matchAll(/<a class="toc-h\d" href="#[^"]*">([\s\S]*?)<\/a>/g)].map(m => m[1])
}

describe('exportStyledHTML — [TOC] with $ in heading text', () => {
  it.each([
    ['Pay in US$$ only'],
    ["Bob$'s notes"],
    ['A$&B'],
    ['before $` after']
  ])('keeps the TOC entry for "%s" verbatim', async(heading) => {
    const out = await exportWithToc(`# Title\n\n[TOC]\n\n## ${heading}\n\nbody text\n`)

    expect(tocLinks(out)).toEqual([heading.replace(/&/g, '&amp;')])
    expect((out.match(/body text/g) || []).length).toBe(1)
  })
})
