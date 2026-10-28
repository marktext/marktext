// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  CloseCoordinator,
  type ClosePorts
} from '../../../src/main/applicationState/closeCoordinator'
import { createDefaultLayout } from '../../../src/shared/applicationState/defaults'
import { createFileLocation } from '../../../src/main/applicationState/identity'
import type { SessionState, WindowSnapshot } from '../../../src/shared/types/applicationState'

const snapshot = (id: string, dirty = true): WindowSnapshot => ({
  id,
  updatedAtMs: 1,
  lastActivatedAtMs: 1,
  workspace: null,
  geometry: {
    normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
    maximized: false,
    displayId: null
  },
  layout: createDefaultLayout(),
  projectView: { roots: [] },
  activeDocumentId: id,
  documents: [
    {
      id,
      title: id,
      readOnly: false,
      resource: { kind: 'untitled' },
      content: dirty ? { kind: 'recovery', contentRevision: 1 } : { kind: 'empty' },
      view: null,
      saveFormat: {
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 2
      }
    }
  ]
})

const setup = (
  choices: Array<'save' | 'discard' | 'cancel'>,
  snapshots = [snapshot('a'), snapshot('b')]
) => {
  let session: SessionState = {
    id: 'session',
    lifecycle: 'running',
    windows: snapshots,
    activeWindowId: snapshots.at(-1)?.id ?? null,
    lastWindow: null
  }
  const events: string[] = []
  const ports: ClosePorts = {
    getSession: () => session,
    checkpoint: vi.fn<ClosePorts['checkpoint']>(async(id) => {
      events.push(`checkpoint:${id}`)
      const window = session.windows.find((entry) => entry.id === id)
      if (!window) throw new Error('Window no longer exists')
      return structuredClone(window)
    }),
    choose: vi.fn<ClosePorts['choose']>(async(window) => {
      events.push(`choose:${window.id}`)
      return choices.shift() ?? 'cancel'
    }),
    save: vi.fn<ClosePorts['save']>(async(window) => {
      events.push(`save:${window.id}`)
      const current = session.windows.find((entry) => entry.id === window.id)
      if (current) {
        for (const document of current.documents) {
          document.resource = {
            kind: 'file',
            location: createFileLocation(`saved-${document.id}.md`),
            pendingCreation: false
          }
          document.content = {
            kind: 'disk',
            baseline: { exists: true, sizeBytes: 1, mtimeMs: 1, rawSha256: 'a'.repeat(64) }
          }
        }
      }
      return 'saved'
    }),
    discard: vi.fn(async(id, ids) => {
      events.push(`discard:${id}`)
      const current = session.windows.find((entry) => entry.id === id)
      if (current)
        current.documents = current.documents.filter((document) => !ids.includes(document.id))
    }),
    commit: vi.fn(async(value) => {
      events.push('commit')
      session = value
    }),
    destroy: vi.fn(async(id) => {
      events.push(`destroy:${id}`)
    })
  }
  return { ports, events, coordinator: new CloseCoordinator(ports), session: () => session }
}

describe('close preparation and commit ordering', () => {
  it('does not interpret a missing window identity as an application quit', async() => {
    const { ports, coordinator } = setup(['discard'])
    await expect(coordinator.closeWindow('')).rejects.toThrow(/identity/i)
    expect(ports.checkpoint).not.toHaveBeenCalled()
    expect(ports.commit).not.toHaveBeenCalled()
  })

  it('does not discard or destroy earlier windows when a later window cancels', async() => {
    const { ports, coordinator, session } = setup(['discard', 'cancel'])
    await coordinator.quit()
    expect(ports.discard).not.toHaveBeenCalled()
    expect(ports.commit).not.toHaveBeenCalled()
    expect(ports.destroy).not.toHaveBeenCalled()
    expect(session().windows.every((window) => window.documents.length === 1)).toBe(true)
  })

  it('commits the complete final session before destroying any window', async() => {
    const { coordinator, session, events } = setup(['save', 'discard'])
    await coordinator.quit()
    expect(session().lifecycle).toBe('closed')
    expect(session().windows.map((window) => window.id)).toEqual(['a', 'b'])
    expect(session().windows[0].documents).toMatchObject([{ content: { kind: 'disk' } }])
    expect(session().windows[1].documents).toEqual([])
    expect(events.indexOf('discard:b')).toBeGreaterThan(events.indexOf('choose:b'))
    expect(events.indexOf('destroy:a')).toBeGreaterThan(events.indexOf('commit'))
    expect(events.indexOf('destroy:b')).toBeGreaterThan(events.indexOf('commit'))
  })

  it('removes only a separately closed window and preserves the other membership', async() => {
    const { coordinator, session, events } = setup(['discard'])
    await coordinator.closeWindow('a')
    expect(session().windows.map((window) => window.id)).toEqual(['b'])
    expect(session().lastWindow).toBeNull()
    expect(events).not.toContain('destroy:b')
  })

  it('keeps windows open for canceled Save As, failed saves, or failed session writes', async() => {
    for (const result of ['canceled', 'failed'] as const) {
      const { ports, coordinator } = setup(['save'])
      vi.mocked(ports.save).mockResolvedValue(result)
      await coordinator.quit()
      expect(ports.destroy).not.toHaveBeenCalled()
      expect(ports.commit).not.toHaveBeenCalled()
    }
    const { ports, coordinator } = setup([], [snapshot('clean', false)])
    vi.mocked(ports.commit).mockRejectedValue(new Error('disk full'))
    await expect(coordinator.quit()).rejects.toThrow('disk full')
    expect(ports.destroy).not.toHaveBeenCalled()
  })

  it('does not discard a newer revision that was not approved in the prompt', async() => {
    const { ports, coordinator, session } = setup(['discard', 'discard'])
    vi.mocked(ports.choose).mockImplementation(async(window) => {
      if (window.id === 'b')
        session().windows[0].documents[0].content = { kind: 'recovery', contentRevision: 2 }
      return 'discard'
    })
    await coordinator.quit()
    expect(ports.discard).not.toHaveBeenCalled()
    expect(ports.destroy).not.toHaveBeenCalled()
  })

  it('does not prompt for untouched documents and retries after a canceled request', async() => {
    const clean = setup([], [snapshot('clean', false)])
    await clean.coordinator.quit()
    expect(clean.ports.choose).not.toHaveBeenCalled()
    expect(clean.ports.destroy).toHaveBeenCalledWith('clean')
    const retry = setup(['cancel', 'discard'], [snapshot('dirty')])
    await retry.coordinator.quit()
    await retry.coordinator.quit()
    expect(retry.ports.destroy).toHaveBeenCalledWith('dirty')
  })

  it('does not commit an application quit if a new window appears during discard', async() => {
    const { ports, coordinator, session } = setup(['discard'], [snapshot('a')])
    vi.mocked(ports.discard).mockImplementation(async() => {
      session().windows[0].documents = []
      session().windows.push(snapshot('new', false))
    })
    await coordinator.quit()
    expect(ports.commit).not.toHaveBeenCalled()
    expect(ports.destroy).not.toHaveBeenCalled()
  })

  it('rejects a checkpoint from the wrong window before prompting or committing', async() => {
    const { ports, coordinator } = setup(['discard'])
    vi.mocked(ports.checkpoint).mockResolvedValue(snapshot('b'))
    await expect(coordinator.closeWindow('a')).rejects.toThrow(/another window/i)
    expect(ports.choose).not.toHaveBeenCalled()
    expect(ports.commit).not.toHaveBeenCalled()
  })
})
