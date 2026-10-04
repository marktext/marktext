import { describe, it, expect, afterEach } from 'vitest'
import type { HarnessStatus, ListModelsResult } from '@shared/types/agent'
import { harnessCardKind, harnessChangeAllowed, modelRows } from '@/agent/harnessCard'
import { anyTurnRunning, setWindowTurn } from '../../../src/main/agent/comments/windowTurn'

const status = (patch: Partial<HarnessStatus>): HarnessStatus => ({
  id: 'opencode',
  found: false,
  resolvedPath: null,
  version: null,
  reason: 'not_found',
  message: null,
  ...patch
})

describe('agent settings harness card', () => {
  it('asks for a path until the program is found', () => {
    expect(harnessCardKind(undefined, null)).toBe('missing')
    expect(harnessCardKind(status({ reason: 'not_executable', resolvedPath: '/bin/opencode' }), null)).toBe('missing')
  })

  it('shows the program as found and lists models', () => {
    const models: ListModelsResult = { ok: true, models: [{ id: 'alpha', label: 'Alpha' }] }
    const found = status({ found: true, reason: null, resolvedPath: '/usr/bin/opencode', version: '1' })
    expect(harnessCardKind(found, models)).toBe('found')
    expect(modelRows(models).map((item) => item.label)).toEqual(['Alpha'])
  })

  it('reports no models when the catalog is empty', () => {
    const found = status({ found: true, reason: null, resolvedPath: '/usr/bin/opencode' })
    expect(harnessCardKind(found, { ok: false, reason: 'no_models' })).toBe('no_models')
    expect(harnessCardKind(found, { ok: true, models: [] })).toBe('no_models')
  })

  it('names sign-in when the harness requires it', () => {
    const found = status({ found: true, reason: 'auth_required', resolvedPath: '/usr/bin/agent' })
    expect(harnessCardKind(found, null)).toBe('login')
  })

  it('keeps the harness switch locked for the whole turn', () => {
    expect(harnessChangeAllowed(false)).toBe(true)
    expect(harnessChangeAllowed(true)).toBe(false)
  })
})

describe('turn presence', () => {
  afterEach(() => {
    setWindowTurn(4, null)
    setWindowTurn(5, null)
  })

  it('is active while any window has a turn', () => {
    expect(anyTurnRunning()).toBe(false)
    setWindowTurn(4, {
      turnId: 't',
      file: 'a.md',
      threadIds: [],
      harness: 'opencode',
      model: 'alpha'
    })
    expect(anyTurnRunning()).toBe(true)
    setWindowTurn(5, {
      turnId: 'u',
      file: 'b.md',
      threadIds: [],
      harness: 'pi',
      model: 'beta'
    })
    setWindowTurn(4, null)
    expect(anyTurnRunning()).toBe(true)
    setWindowTurn(5, null)
    expect(anyTurnRunning()).toBe(false)
  })
})
