import path from 'path'
import os from 'os'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { isExecutableFile } from 'common/filesystem'

let dir: string

const skipOnWindows = process.platform === 'win32'

beforeAll(async() => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mt-executable-'))
})

afterAll(async() => {
  await fs.remove(dir)
})

const write = async(name: string, mode: number) => {
  const file = path.join(dir, name)
  await fs.writeFile(file, '#!/bin/sh\nexit 0\n', { mode })
  return file
}

describe('isExecutableFile', () => {
  it('accepts a file this process can run', async() => {
    expect(isExecutableFile(await write('runnable', 0o755))).toBe(true)
  })

  it('refuses a file without the bit', async() => {
    expect(isExecutableFile(await write('plain', 0o644))).toBe(false)
  })

  it('refuses a directory and a path that is not there', async() => {
    expect(isExecutableFile(dir)).toBe(false)
    expect(isExecutableFile(path.join(dir, 'absent'))).toBe(false)
  })

  it.skipIf(skipOnWindows)('refuses a bit this process does not own', async() => {
    // Only the "other" bit, with this user as owner: POSIX consults the owner
    // bits alone, so a bit test calls it executable and the spawn gets EACCES.
    expect(isExecutableFile(await write('other-x-only', 0o001))).toBe(false)
  })
})
