import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { listModels } from 'main_renderer/agent/harness/modelProbe'

const fixture = path.join(process.cwd(), 'test/fixtures/fake-acp-agent/agent.mjs')
const dirs: string[] = []

afterEach(() => {
  delete process.env.FAKE_ACP_MODE
  delete process.env.FAKE_ACP_LOG
  delete process.env.FAKE_ACP_CWD
  delete process.env.FAKE_ACP_MODELS
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

const tempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-models-'))
  dirs.push(dir)
  return dir
}

const readLog = (logPath: string): { event?: string, method?: string, params?: { cwd?: string, mcpServers?: unknown[] } }[] => {
  if (!fs.existsSync(logPath)) return []
  return fs.readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { event?: string, method?: string, params?: { cwd?: string, mcpServers?: unknown[] } })
}

const starts = (logPath: string): number =>
  readLog(logPath).filter((entry) => entry.event === 'start').length

describe('listModels', () => {
  it('returns the model catalog, caches it, and probes again on refresh', async() => {
    const dir = tempDir()
    const script = path.join(dir, 'agent.mjs')
    fs.copyFileSync(fixture, script)
    fs.chmodSync(script, 0o755)
    const logPath = path.join(dir, 'agent.log')
    const cacheFile = path.join(dir, 'agent', 'model-cache.json')
    const repo = path.join(dir, 'repo')
    fs.mkdirSync(repo)
    process.env.FAKE_ACP_MODE = 'happy'
    process.env.FAKE_ACP_LOG = logPath

    const first = await listModels({
      harness: 'pi',
      repoRoot: repo,
      configuredPath: script,
      cacheFile
    })
    const second = await listModels({
      harness: 'pi',
      repoRoot: repo,
      configuredPath: script,
      cacheFile
    })

    expect(first).toEqual({
      ok: true,
      models: [
        { id: 'alpha', label: 'Alpha' },
        { id: 'beta', label: 'Beta' }
      ]
    })
    expect(second).toEqual(first)
    expect(starts(logPath)).toBe(1)
    const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as {
      pi: { fetchedAt: string, models: { id: string, label: string }[] }
    }
    expect(stored.pi.models).toEqual([
      { id: 'alpha', label: 'Alpha' },
      { id: 'beta', label: 'Beta' }
    ])
    expect(stored.pi.fetchedAt).toEqual(expect.any(String))

    process.env.FAKE_ACP_MODELS = 'gamma:Gamma'
    const refreshed = await listModels({
      harness: 'pi',
      refresh: true,
      repoRoot: repo,
      configuredPath: script,
      cacheFile
    })
    expect(refreshed).toEqual({ ok: true, models: [{ id: 'gamma', label: 'Gamma' }] })
    expect(starts(logPath)).toBe(2)
  })

  it('reports no_models when the agent has no model option', async() => {
    const dir = tempDir()
    const script = path.join(dir, 'agent.mjs')
    fs.copyFileSync(fixture, script)
    fs.chmodSync(script, 0o755)
    process.env.FAKE_ACP_MODE = 'no-models'
    process.env.FAKE_ACP_LOG = path.join(dir, 'agent.log')
    const repo = path.join(dir, 'repo')
    fs.mkdirSync(repo)

    const result = await listModels({
      harness: 'pi',
      repoRoot: repo,
      configuredPath: script,
      cacheFile: path.join(dir, 'agent', 'model-cache.json')
    })

    expect(result).toEqual({ ok: false, reason: 'no_models' })
    expect(fs.existsSync(path.join(dir, 'agent', 'model-cache.json'))).toBe(false)
  })

  it('probes in a temporary directory when no repository is open', async() => {
    const dir = tempDir()
    const script = path.join(dir, 'agent.mjs')
    fs.copyFileSync(fixture, script)
    fs.chmodSync(script, 0o755)
    const logPath = path.join(dir, 'agent.log')
    process.env.FAKE_ACP_MODE = 'happy'
    process.env.FAKE_ACP_LOG = logPath

    const result = await listModels({
      harness: 'pi',
      repoRoot: null,
      configuredPath: script,
      cacheFile: path.join(dir, 'agent', 'model-cache.json')
    })

    expect(result.ok).toBe(true)
    const created = readLog(logPath).find((entry) => entry.method === 'session/new')
    expect(created?.params?.cwd?.startsWith(os.tmpdir())).toBe(true)
    expect(created?.params?.mcpServers).toEqual([])
    expect(fs.existsSync(created?.params?.cwd ?? '')).toBe(false)
  })

  it('reports not_found without spawning when the configured path is missing', async() => {
    const dir = tempDir()
    const result = await listModels({
      harness: 'opencode',
      repoRoot: dir,
      configuredPath: path.join(dir, 'missing'),
      cacheFile: path.join(dir, 'model-cache.json')
    })
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})
