import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { WorkspaceDescriptor } from '../../../src/shared/types/applicationState'
const { listeners } = vi.hoisted(() => {
  Object.assign(window, {
    path: { sep: '/' },
    electron: { ipcRenderer: { send: () => {}, on: () => {} } }
  })
  return { listeners: new Map<string, (...args: unknown[]) => void>() }
})
vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/checkpoint', () => ({ scheduleWindowCheckpoint: vi.fn() }))
import { useProjectStore } from '@/store/project'

const workspace: WorkspaceDescriptor = {
  id: 'workspace',
  roots: [
    { id: 'a-id', location: { path: '/a', canonicalPath: '/a', key: 'a-id' } },
    { id: 'b-id', location: { path: '/b', canonicalPath: '/b', key: 'b-id' } }
  ]
}
beforeEach(() => {
  Object.assign(window, {
    path,
    electron: {
      ipcRenderer: {
        send: vi.fn(),
        on: (name: string, listener: (...args: unknown[]) => void) => listeners.set(name, listener)
      }
    }
  })
  setActivePinia(createPinia())
  listeners.clear()
})
const initialize = () => {
  const store = useProjectStore()
  store.APPLY_ROOTS({
    revision: 1,
    reason: 'restore',
    roots: ['/a', '/b'].map((pathname) => ({
      key: pathname,
      pathname,
      watchToken: pathname,
      status: 'loading'
    }))
  })
  store.LISTEN_FOR_UPDATE_PROJECT()
  return store
}
const addDirectory = (pathname: string) =>
  listeners.get('mt::update-object-tree')?.(null, {
    rootKey: pathname.startsWith('/a') ? '/a' : '/b',
    watchToken: pathname.startsWith('/a') ? '/a' : '/b',
    type: 'addDir',
    change: { pathname }
  })
describe('workspace-root view state', () => {
  it('keeps a fresh workspace root expanded and lazy descendants collapsed without historical state', () => {
    const store = initialize()
    store.RESTORE_PROJECT_VIEW(workspace, { roots: [] })
    addDirectory('/a/notes')
    expect(store.roots[0].tree.isCollapsed).toBe(false)
    expect(store.roots[0].tree.folders[0].isCollapsed).toBe(true)
    expect(store.restoringSession).toBe(false)
  })
  it('matches a displayed alias through the native canonical root key', () => {
    const store = useProjectStore()
    store.APPLY_ROOTS({ revision: 1, reason: 'restore', roots: [{ key: '/a', pathname: '/alias-a', watchToken: 'alias', status: 'loading' }] })
    store.SET_FOLDER_COLLAPSED(store.roots[0].tree, true)
    expect(store.CAPTURE_PROJECT_VIEW(workspace).roots[0].collapsedPaths).toEqual([''])
    store.RESTORE_PROJECT_VIEW(workspace, { roots: [{ rootId: 'a-id', collapsedPaths: [] }] })
    expect(store.roots[0].tree.isCollapsed).toBe(false)
  })
  it('rebuilds lazy file trees with the intended root and descendant folds', () => {
    const first = initialize()
    addDirectory('/a/notes')
    first.SET_FOLDER_COLLAPSED(first.roots[0].tree.folders[0], true)
    first.SET_FOLDER_COLLAPSED(first.roots[1].tree, true)
    const state = first.CAPTURE_PROJECT_VIEW(workspace)
    setActivePinia(createPinia())
    const restored = initialize()
    restored.RESTORE_PROJECT_VIEW(workspace, state)
    addDirectory('/a/notes')
    expect(restored.roots[0].tree.folders[0].isCollapsed).toBe(true)
    expect(restored.roots[1].tree.isCollapsed).toBe(true)
    expect(restored.CAPTURE_PROJECT_VIEW(workspace)).toEqual(state)
  })
  it('ignores foreign roots and unsafe relative paths and resets when restoration is disabled', () => {
    const store = initialize()
    addDirectory('/a/notes')
    store.RESTORE_PROJECT_VIEW(workspace, {
      roots: [
        { rootId: 'a-id', collapsedPaths: ['notes', '../escape', '/absolute', 'C:\\absolute'] },
        { rootId: 'foreign', collapsedPaths: [''] }
      ]
    })
    expect(store.CAPTURE_PROJECT_VIEW(workspace).roots).toEqual([
      { rootId: 'a-id', collapsedPaths: ['notes'] },
      { rootId: 'b-id', collapsedPaths: [] }
    ])
    store.RESTORE_PROJECT_VIEW(workspace, { roots: [] })
    expect(store.roots[0].tree.folders[0].isCollapsed).toBe(true)
  })
})
