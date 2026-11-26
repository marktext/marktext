// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import type EditorWindow from '../../../src/main/windows/editor'
import { TabDrag } from '../../../src/main/applicationState/tabDrag'

const { cursor, windows } = vi.hoisted(() => ({ cursor: vi.fn(), windows: vi.fn() }))
vi.mock('electron', () => ({
  app: { commandLine: { getSwitchValue: () => '' } },
  screen: { getCursorScreenPoint: cursor },
  BrowserWindow: { getAllWindows: windows }
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

const fixture = () => {
  vi.useFakeTimers()
  const native = (x: number) => ({
    isVisible: () => true,
    isMinimized: () => false,
    isAlwaysOnTop: () => false,
    isFocused: () => x === 0,
    isDestroyed: () => false,
    getBounds: () => ({ x, y: 0, width: 600, height: 700 }),
    getContentBounds: () => ({ x, y: 0, width: 600, height: 700 }),
    webContents: { getZoomFactor: () => 1, send: vi.fn() }
  })
  const source = native(0)
  const destination = native(650)
  const unrelated = native(1300)
  windows.mockReturnValue([source, destination, unrelated])
  const editors = new Map([
    ['source', { browserWindow: source } as unknown as EditorWindow],
    ['destination', { browserWindow: destination } as unknown as EditorWindow]
  ])
  const transfer = vi.fn().mockResolvedValue(undefined)
  const drag = new TabDrag(editors, transfer)
  for (const id of editors.keys())
    drag.strip(id, {
      left: 0, top: 0, right: 600, bottom: 40,
      tabs: [{ id: id === 'source' ? 'document' : 'other', middle: 100 }]
    })
  return { drag, transfer }
}

it.each([
  ['source content', { x: 200, y: 200 }],
  ['destination content', { x: 800, y: 200 }],
  ['unrelated window', { x: 1400, y: 200 }],
  ['desktop', { x: -200, y: -200 }],
  ['just below the source strip', { x: 200, y: 40 }]
])('creates a new window when dropping over %s', async(_name, point) => {
  const { drag, transfer } = fixture()
  cursor.mockReturnValue(point)
  drag.begin('source', 'document')
  await drag.finish('source', false)
  expect(transfer).toHaveBeenCalledExactlyOnceWith('source', 'document', null, null, point)
})

it('keeps sorting within the source strip local', async() => {
  const { drag, transfer } = fixture()
  cursor.mockReturnValue({ x: 50, y: 20 })
  drag.begin('source', 'document')
  await drag.finish('source', false)
  expect(transfer).not.toHaveBeenCalled()
})

it('inserts into another window only when its tab strip is hit', async() => {
  const { drag, transfer } = fixture()
  const point = { x: 700, y: 20 }
  cursor.mockReturnValue(point)
  drag.begin('source', 'document')
  await drag.finish('source', false)
  expect(transfer).toHaveBeenCalledExactlyOnceWith('source', 'document', 'destination', 'other', point)
})

it('cancels a drop outside the strip without creating a window', async() => {
  const { drag, transfer } = fixture()
  cursor.mockReturnValue({ x: 200, y: 200 })
  drag.begin('source', 'document')
  await drag.finish('source', true)
  expect(transfer).not.toHaveBeenCalled()
})
