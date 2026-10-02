import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  HARNESS_DESCRIPTORS,
  changedHarnessIds,
  clearHarnessStatusCache,
  getHarnessStatus
} from 'main_renderer/agent/harness/harnessRegistry'
import {
  resolveHarnessCommand,
  spawnForResolved
} from 'main_renderer/agent/harness/resolveHarnessCommand'

const dirs: string[] = []

afterEach(() => {
  clearHarnessStatusCache()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-harness-'))
  dirs.push(dir)
  return dir
}

const executable = (filePath: string, contents: string): void => {
  fs.writeFileSync(filePath, contents, { mode: 0o755 })
  fs.chmodSync(filePath, 0o755)
}

const withPlatform = <T>(platform: NodeJS.Platform, run: () => T): T => {
  const previous = process.platform
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(process, 'platform', { value: previous, configurable: true })
  }
}

const fakeAgent = (dir: string, name: string): string => {
  const filePath = path.join(dir, name)
  executable(filePath, `#!${process.execPath}
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'

const log = process.env.FAKE_ACP_LOG
if (log) appendFileSync(log, 'start\\n')

const lines = createInterface({ input: process.stdin })
lines.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try {
    message = JSON.parse(trimmed)
  } catch {
    return
  }
  if (message.method !== 'initialize') return
  const capabilities = message.params && message.params.clientCapabilities
  if (capabilities && (capabilities.fs || capabilities.terminal)) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32603, message: 'client capabilities must be empty' }
    }) + '\\n')
    return
  }
  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: message.id,
    result: {
      protocolVersion: 1,
      agentInfo: { name: 'fake-acp', version: '9.9.9' },
      agentCapabilities: { loadSession: true }
    }
  }) + '\\n')
})
`)
  return filePath
}

describe('harness descriptors', () => {
  it('uses the quirks measured and proposed by the B-0 spike', () => {
    expect(HARNESS_DESCRIPTORS.map((descriptor) => ({
      id: descriptor.id,
      command: descriptor.defaultCommand,
      args: descriptor.defaultArgs,
      quirks: descriptor.quirks
    }))).toEqual([
      {
        id: 'opencode',
        command: 'opencode',
        args: ['acp'],
        quirks: { repliesVia: 'mcp', resume: 'auto', authMethodId: 'opencode-login' }
      },
      {
        id: 'pi',
        command: 'pi-acp',
        args: [],
        quirks: { repliesVia: 'block', resume: 'auto' }
      },
      {
        id: 'cursor',
        command: 'agent',
        args: ['acp'],
        quirks: { repliesVia: 'block', resume: 'auto', authMethodId: 'cursor_login' }
      }
    ])
  })
})

describe('resolveHarnessCommand', () => {
  it('searches PATH when the setting is empty', () => {
    const dir = tempDir()
    const bin = path.join(dir, 'opencode')
    executable(bin, '#!/bin/sh\nexit 0\n')

    const resolved = resolveHarnessCommand('opencode', ['acp'], '', { PATH: dir })

    expect(resolved).toEqual({
      ok: true,
      resolvedPath: bin,
      command: bin,
      args: ['acp']
    })
  })

  it('reports not_found for a missing path and does not fall through to PATH', () => {
    const dir = tempDir()
    const bin = path.join(dir, 'opencode')
    executable(bin, '#!/bin/sh\nexit 0\n')
    const missing = path.join(dir, 'missing-opencode')

    const resolved = resolveHarnessCommand('opencode', ['acp'], missing, { PATH: dir })

    expect(resolved).toEqual({ ok: false, reason: 'not_found' })
  })

  it('reports not_executable when the path exists but cannot be run', () => {
    const dir = tempDir()
    const bin = path.join(dir, 'opencode')
    fs.writeFileSync(bin, 'not a program')
    fs.chmodSync(bin, 0o644)

    const resolved = resolveHarnessCommand('opencode', ['acp'], bin, { PATH: dir })

    expect(resolved).toEqual({ ok: false, reason: 'not_executable', resolvedPath: bin })
  })

  it('finds a .cmd via PATHEXT and launches it through cmd.exe when platform is win32', () => {
    const dir = tempDir()
    const bin = path.join(dir, 'opencode.CMD')
    executable(bin, '@echo off\r\n')

    const resolved = withPlatform('win32', () =>
      resolveHarnessCommand('opencode', ['acp'], '', {
        PATH: dir,
        PATHEXT: '.COM;.EXE;.BAT;.CMD'
      })
    )

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.resolvedPath).toBe(bin)
    expect(resolved.command).toBe('cmd.exe')
    expect(resolved.args.slice(0, 3)).toEqual(['/d', '/s', '/c'])
    expect(resolved.args).toHaveLength(4)
    expect(resolved.args[3]).toContain(bin)
    expect(resolved.args[3]).toContain('acp')
    expect(resolved.args[3]?.startsWith('"')).toBe(true)
    expect(resolved.args[3]?.endsWith('"')).toBe(true)
  })

  it('does not wrap a non-batch executable when platform is win32', () => {
    const dir = tempDir()
    const bin = path.join(dir, 'pi-acp')
    executable(bin, '#!/bin/sh\nexit 0\n')

    const resolved = withPlatform('win32', () =>
      resolveHarnessCommand('pi-acp', [], '', {
        PATH: dir,
        PATHEXT: '.COM;.EXE;.BAT;.CMD'
      })
    )

    expect(resolved).toEqual({
      ok: true,
      resolvedPath: bin,
      command: bin,
      args: []
    })
  })

  it('quotes spaces and percent signs for cmd.exe /c', () => {
    const spec = spawnForResolved('C:\\Program Files\\a%b.cmd', ['acp'], 'win32', {
      ComSpec: 'C:\\Windows\\System32\\cmd.exe'
    })

    expect(spec).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', '""C:\\Program Files\\a%%b.cmd" acp"']
    })
  })
})

describe('getHarnessStatus', () => {
  it('reports the fake agent as found and reuses the result until the path changes', async() => {
    const dir = tempDir()
    const logPath = path.join(dir, 'starts.txt')
    const firstAgent = fakeAgent(dir, 'fake-a.mjs')
    const secondAgent = fakeAgent(dir, 'fake-b.mjs')
    const missing = path.join(dir, 'missing')
    const previous = process.env.FAKE_ACP_LOG
    process.env.FAKE_ACP_LOG = logPath

    try {
      const paths = { opencode: firstAgent, pi: missing, cursor: missing }
      const first = await getHarnessStatus(paths)
      const second = await getHarnessStatus(paths)

      expect(first.find((status) => status.id === 'opencode')).toEqual({
        id: 'opencode',
        found: true,
        resolvedPath: firstAgent,
        version: '9.9.9',
        reason: null,
        message: null
      })
      expect(first.filter((status) => status.id !== 'opencode').map((status) => status.reason))
        .toEqual(['not_found', 'not_found'])
      expect(second).toEqual(first)
      expect(fs.readFileSync(logPath, 'utf8')).toBe('start\n')

      await getHarnessStatus({ ...paths, opencode: secondAgent })
      expect(fs.readFileSync(logPath, 'utf8')).toBe('start\nstart\n')
    } finally {
      if (previous === undefined) delete process.env.FAKE_ACP_LOG
      else process.env.FAKE_ACP_LOG = previous
    }
  })

  it('reports not_found without spawning when the configured path is missing', async() => {
    const dir = tempDir()
    const missing = path.join(dir, 'missing')
    const statuses = await getHarnessStatus({
      opencode: missing,
      pi: missing,
      cursor: missing
    })

    expect(statuses.map((status) => status.reason)).toEqual(['not_found', 'not_found', 'not_found'])
    expect(statuses.every((status) => status.found === false && status.resolvedPath === null)).toBe(true)
  })
})

describe('harness path settings', () => {
  it('treats only the three path keys as a status invalidation', () => {
    expect(changedHarnessIds({ agentPiPath: '/opt/pi-acp', theme: 'dark' })).toEqual(['pi'])
    expect(changedHarnessIds({ theme: 'dark' })).toEqual([])
  })
})
