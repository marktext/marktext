// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { supportsTabScreenCoordinates, TabDrag } from '../../../src/main/applicationState/tabDrag'

const { commandLine, cursor } = vi.hoisted(() => ({
  commandLine: vi.fn(() => ''),
  cursor: vi.fn()
}))
vi.mock('electron', () => ({
  app: { commandLine: { getSwitchValue: commandLine } },
  screen: { getCursorScreenPoint: cursor },
  BrowserWindow: { getAllWindows: () => [] }
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it('uses local sorting and menus on Wayland without querying global coordinates', () => {
  vi.stubEnv('XDG_SESSION_TYPE', 'wayland')
  const transfer = vi.fn()
  const drag = new TabDrag(new Map(), transfer)
  expect(drag.canBegin()).toBe(false)
  expect(cursor).not.toHaveBeenCalled()
  expect(transfer).not.toHaveBeenCalled()
})

it.each([
  ['linux', '', { XDG_SESSION_TYPE: 'wayland' }, false],
  ['linux', '', { WAYLAND_DISPLAY: 'wayland-0' }, false],
  ['linux', 'wayland', {}, false],
  ['linux', 'x11', { XDG_SESSION_TYPE: 'wayland' }, true],
  ['linux', '', { XDG_SESSION_TYPE: 'x11' }, true],
  ['win32', '', {}, true],
  ['darwin', '', {}, true]
])(
  'checks coordinates on %s with ozone %s and environment %j',
  (platform, ozone, environment, expected) => {
    expect(supportsTabScreenCoordinates(platform, ozone, environment)).toBe(expected)
  }
)
