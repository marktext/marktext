import { createHash } from 'crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { copyFileWithContentHash } from 'main_renderer/filesystem'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-5344-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const sha1 = (data: Buffer): string => createHash('sha1').update(data).digest('hex')

describe('copyFileWithContentHash (#5344)', () => {
  it('names the copy after the SHA-1 of the file bytes, not of its path', async() => {
    const src = path.join(tempDir(), 'shot.png')
    const outputDir = tempDir()
    const bytes = Buffer.from('first image')
    writeFileSync(src, bytes)

    const dest = await copyFileWithContentHash(src, outputDir)

    expect(dest).toBe(path.join(outputDir, `${sha1(bytes)}.png`))
    expect(readFileSync(dest)).toEqual(bytes)
    expect(readdirSync(outputDir)).toEqual([path.basename(dest)])
  })

  it('gives a changed file at the same path a new name and leaves the earlier copy intact', async() => {
    const src = path.join(tempDir(), 'shot.png')
    const outputDir = tempDir()
    writeFileSync(src, 'first image')
    const first = await copyFileWithContentHash(src, outputDir)

    writeFileSync(src, 'second image')
    const second = await copyFileWithContentHash(src, outputDir)

    expect(second).not.toBe(first)
    expect(readFileSync(first, 'utf8')).toBe('first image')
    expect(readFileSync(second, 'utf8')).toBe('second image')
  })

  it('reuses the existing copy when the same bytes arrive from another path', async() => {
    const outputDir = tempDir()
    const a = path.join(tempDir(), 'a.png')
    const b = path.join(tempDir(), 'b.png')
    writeFileSync(a, 'same image')
    writeFileSync(b, 'same image')

    const first = await copyFileWithContentHash(a, outputDir)
    const { ino } = statSync(first)
    const second = await copyFileWithContentHash(b, outputDir)

    expect(second).toBe(first)
    expect(statSync(second).ino).toBe(ino)
    expect(readdirSync(outputDir)).toEqual([path.basename(first)])
  })

  it('rejects without leaving a partial file when the source is missing', async() => {
    const outputDir = tempDir()

    await expect(
      copyFileWithContentHash(path.join(outputDir, 'missing.png'), outputDir)
    ).rejects.toThrow()
    expect(readdirSync(outputDir)).toEqual([])
  })
})
