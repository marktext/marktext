import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readDoc, renderMarkdown } from '../src/lib/markdown'

test('renders emoji prose without rewriting code or unknown shortcodes', async () => {
  const { html } = await renderMarkdown(':heart_eyes: :smile: :joy: :not_an_emoji:\n\n`:smile:`\n\n```text\n:joy:\n```', 'end-user/MARKDOWN_SYNTAX.md')
  assert.match(html, /😍 😄 😂 :not_an_emoji:/)
  assert.match(html, /<code[^>]*class="inline">(?:(?!<\/code>)[\s\S])*:smile:/)
  assert.match(html, /data-copy=":joy:/)
})

test('preserves keyboard markup while sanitizing unsafe HTML', async () => {
  const { html } = await renderMarkdown('Press <kbd onclick="alert(1)">Ctrl</kbd>+<kbd>C</kbd><script>alert(1)</script>', 'end-user/MARKDOWN_SYNTAX.md')
  assert.match(html, /<kbd>Ctrl<\/kbd>\+<kbd>C<\/kbd>/)
  assert.doesNotMatch(html, /onclick|<script/)
})

test('preserves the highlight example while removing unsafe attributes', async () => {
  const { html } = await renderMarkdown('<mark onclick="alert(1)">Highlight this text.</mark>', 'end-user/MARKDOWN_SYNTAX.md')
  assert.match(html, /<mark>Highlight this text\.<\/mark>/)
  assert.doesNotMatch(html, /onclick/)
})

test('prepares all documented diagrams and keeps copyable source', async () => {
  const { html } = await renderMarkdown(await readDoc('end-user/MARKDOWN_SYNTAX.md'), 'end-user/MARKDOWN_SYNTAX.md')
  assert.equal((html.match(/class="diagram-preview"/g) ?? []).length, 9)
  assert.equal((html.match(/<summary>Diagram source<\/summary>/g) ?? []).length, 9)
  for (const language of ['mermaid', 'vega-lite', 'flowchart', 'sequence', 'plantuml']) {
    assert.ok(html.includes(`data-diagram-language="${language}"`))
  }
  for (const syntax of ['graph TD;', 'sequenceDiagram', 'gantt', 'classDiagram']) {
    assert.ok(html.includes(`data-diagram-source="${syntax}`))
    assert.ok(html.includes(`data-copy="${syntax}`))
  }
})
