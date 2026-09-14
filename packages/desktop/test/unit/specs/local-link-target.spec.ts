import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveLocalLinkTarget } from 'main_renderer/filesystem'

describe('resolveLocalLinkTarget (#5292)', () => {
  let dir: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-link-target-'))
    fs.writeFileSync(path.join(dir, 'other.md'), '')
    fs.writeFileSync(path.join(dir, 'C#.md'), '')
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('resolves a relative link against the document directory', () => {
    expect(resolveLocalLinkTarget('other.md', dir)).toEqual({
      pathname: path.join(dir, 'other.md'),
      anchor: ''
    })
  })

  it('splits the fragment off a link to another document', () => {
    expect(resolveLocalLinkTarget('other.md#english-section', dir)).toEqual({
      pathname: path.join(dir, 'other.md'),
      anchor: 'english-section'
    })
  })

  it('decodes the path but leaves the anchor for the renderer to decode', () => {
    expect(resolveLocalLinkTarget('my%20notes.md#%E4%B8%AD%E6%96%87', dir)).toEqual({
      pathname: path.join(dir, 'my notes.md'),
      anchor: '%E4%B8%AD%E6%96%87'
    })
  })

  it('keeps a "#" that is part of an existing file name', () => {
    expect(resolveLocalLinkTarget('C#.md', dir)).toEqual({
      pathname: path.join(dir, 'C#.md'),
      anchor: ''
    })
  })

  it('resolves an absolute link without a document directory', () => {
    const target = path.join(dir, 'other.md')
    expect(resolveLocalLinkTarget(`${target}#section`, '')).toEqual({
      pathname: target,
      anchor: 'section'
    })
  })
})
