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

describe('resolveLocalLinkTarget percent-encoding (#4749)', () => {
  let root: string
  let percentDir: string
  let escapeLikeDir: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-link-percent-'))

    // A folder name may legally contain a bare '%', which is not a valid escape.
    percentDir = path.join(root, '50%off')
    fs.mkdirSync(percentDir)
    fs.writeFileSync(path.join(percentDir, 'plain.md'), '')
    fs.writeFileSync(path.join(percentDir, 'bad name.md'), '')

    // A folder name may also look like an escape without being one.
    escapeLikeDir = path.join(root, 'my%20docs')
    fs.mkdirSync(escapeLikeDir)
    fs.writeFileSync(path.join(escapeLikeDir, 'plain.md'), '')
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('resolves a link in a document folder whose name contains a bare "%"', () => {
    expect(resolveLocalLinkTarget('plain.md', percentDir)).toEqual({
      pathname: path.join(percentDir, 'plain.md'),
      anchor: ''
    })
  })

  it('decodes the link target inside such a folder', () => {
    expect(resolveLocalLinkTarget('bad%20name.md', percentDir)).toEqual({
      pathname: path.join(percentDir, 'bad name.md'),
      anchor: ''
    })
  })

  it('leaves an escape-looking document folder name untouched', () => {
    expect(resolveLocalLinkTarget('plain.md', escapeLikeDir)).toEqual({
      pathname: path.join(escapeLikeDir, 'plain.md'),
      anchor: ''
    })
  })
})
