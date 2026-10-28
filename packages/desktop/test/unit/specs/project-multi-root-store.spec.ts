import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ProjectRoot, ProjectRootsSnapshot } from '@shared/types/project'

vi.hoisted(() => {
  Object.assign(window, { path: { sep: '/' } })
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/checkpoint', () => ({
  scheduleWindowCheckpoint: vi.fn(),
  requestWindowCheckpoint: vi.fn()
}))

import { useProjectStore } from '@/store/project'

const listeners = new Map<string, (event: unknown, payload: unknown) => void>()
const root = (pathname: string, watchToken = pathname): ProjectRoot => ({
  key: pathname,
  pathname,
  watchToken,
  status: 'ready'
})
const snapshot = (
  revision: number,
  roots: ProjectRoot[],
  reason: ProjectRootsSnapshot['reason'] = 'add'
): ProjectRootsSnapshot => ({ revision, roots, reason })

const workspace = (...paths: string[]) => ({
  id: 'workspace',
  roots: paths.map(pathname => ({
    id: pathname,
    location: { path: pathname, canonicalPath: pathname, key: pathname }
  }))
})

describe('multi-root renderer state (#2222)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listeners.clear()
    Object.assign(window, {
      path: path.posix,
      fileUtils: { isSamePathSync: (a: string, b: string) => a === b },
      electron: {
        ipcRenderer: {
          send: vi.fn(),
          invoke: vi.fn(),
          on: (event: string, listener: (event: unknown, payload: unknown) => void) =>
            listeners.set(event, listener)
        }
      }
    })
  })

  it('preserves unchanged trees and cannot resurrect roots from an older snapshot', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS(snapshot(1, [root('/a')]))
    store.roots[0].tree.isCollapsed = true
    store.APPLY_ROOTS(snapshot(2, [root('/a'), root('/b')]))
    expect(store.roots[0].tree.isCollapsed).toBe(true)
    store.APPLY_ROOTS(snapshot(3, [root('/b')], 'remove'))
    store.APPLY_ROOTS(snapshot(2, [root('/a'), root('/b')]))
    expect(store.roots.map((item) => item.pathname)).toEqual(['/b'])
  })

  it('routes tree events by root and rejects events from replaced listeners', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS(snapshot(1, [root('/a'), root('/b')]))
    store.LISTEN_FOR_UPDATE_PROJECT()
    const event = listeners.get('mt::update-object-tree')!
    const change = {
      pathname: '/b/doc.md',
      name: 'doc.md',
      isMarkdown: true,
      isFile: true,
      isDirectory: false
    }
    event({}, { rootKey: '/a', watchToken: '/a', type: 'add', change })
    event({}, { rootKey: '/b', watchToken: 'obsolete', type: 'add', change })
    expect(store.roots[0].tree.files).toHaveLength(0)
    expect(store.roots[1].tree.files).toHaveLength(0)
    event({}, { rootKey: '/b', watchToken: '/b', type: 'add', change })
    expect(store.roots[1].tree.files[0].pathname).toBe('/b/doc.md')
  })

  it('uses explicit selection or a unique usable root for default IO paths', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS(snapshot(1, [root('/a'), root('/b')]))
    expect(store.GET_DEFAULT_DIRECTORY()).toBe('')
    store.CHANGE_ACTIVE_ITEM({ pathname: '/b/doc.md' })
    expect(store.GET_DEFAULT_DIRECTORY()).toBe('/b')
    store.APPLY_ROOTS(snapshot(2, [root('/a')], 'remove'))
    expect(store.activeItem).toEqual({})
    expect(store.GET_DEFAULT_DIRECTORY()).toBe('/a')
  })

  it('restores folded roots and descendants without resetting them on ready', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS(snapshot(1, [{ ...root('/a'), status: 'loading' }], 'restore'))
    store.RESTORE_PROJECT_VIEW(workspace('/a'), { roots: [{ rootId: '/a', collapsedPaths: ['', 'closed'] }] })
    store.LISTEN_FOR_UPDATE_PROJECT()
    const event = listeners.get('mt::update-object-tree')!
    for (const name of ['closed', 'open']) {
      event(
        {},
        { rootKey: '/a', watchToken: '/a', type: 'addDir', change: { pathname: `/a/${name}` } }
      )
    }
    store.APPLY_ROOTS(snapshot(2, [root('/a')], 'status'))
    expect(store.roots[0].tree.isCollapsed).toBe(true)
    expect(store.roots[0].tree.folders.map((folder) => folder.isCollapsed)).toEqual([true, false])
    expect(store.CAPTURE_PROJECT_VIEW(workspace('/a')).roots[0].collapsedPaths).toEqual(['', 'closed'])
  })

  it('labels same-name roots distinctly and keeps unavailable-root fold data', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS(
      snapshot(
        1,
        [root('/work/notes'), { ...root('/home/notes'), status: 'unavailable' }],
        'restore'
      )
    )
    store.RESTORE_PROJECT_VIEW(workspace('/work/notes', '/home/notes'), {
      roots: [{ rootId: '/home/notes', collapsedPaths: ['lost-child'] }]
    })
    expect(store.FILE_LABEL('/work/notes/a.md')).toContain('/work')
    expect(store.FILE_LABEL('/home/notes/a.md')).toContain('/home')
    expect(store.CAPTURE_PROJECT_VIEW(workspace('/work/notes', '/home/notes')).roots[1].collapsedPaths).toContain('lost-child')
  })
})
