import { describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('electron', () => ({ screen: {} }))

import { applyWindowOpacity, clampWindowOpacity } from 'main_renderer/windows/utils'
import { decreaseWindowOpacity, increaseWindowOpacity } from 'main_renderer/menu/actions/window'
import type Preference from 'main_renderer/preferences'
import type { BrowserWindow } from 'electron'

import {
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
  WINDOW_OPACITY_STEP
} from '@shared/types/preferences'

const makePreferences = (initial: number | undefined) => {
  let stored = initial
  const preferences = {
    getItem: vi.fn(() => stored),
    setItem: vi.fn((_key: string, value: number) => {
      stored = value
    })
  }
  return {
    preferences: preferences as unknown as Preference,
    getStored: () => stored
  }
}

describe('window opacity preference', () => {
  it('keeps the schema and first-start defaults in sync', () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../src/main/preferences/schema.json'), 'utf8')
    ) as Record<string, unknown>
    const defaults = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../../static/preference.json'), 'utf8')
    ) as Record<string, unknown>

    expect(schema.windowOpacity).toMatchObject({
      type: 'number',
      minimum: WINDOW_OPACITY_MIN,
      maximum: WINDOW_OPACITY_MAX,
      default: WINDOW_OPACITY_MAX
    })
    expect(defaults.windowOpacity).toBe(WINDOW_OPACITY_MAX)
  })

  it('converts the stored percentage to the fraction Electron expects', () => {
    const win = { setOpacity: vi.fn() } as unknown as BrowserWindow

    applyWindowOpacity(win, 80)
    expect(win.setOpacity).toHaveBeenCalledWith(0.8)

    applyWindowOpacity(win, undefined)
    expect(win.setOpacity).toHaveBeenLastCalledWith(1)
  })

  it('clamps out-of-range and invalid values', () => {
    expect(clampWindowOpacity(-10)).toBe(WINDOW_OPACITY_MIN)
    expect(clampWindowOpacity(150)).toBe(WINDOW_OPACITY_MAX)
    expect(clampWindowOpacity(80.4)).toBe(80)
    expect(clampWindowOpacity(Number.NaN)).toBe(WINDOW_OPACITY_MAX)
  })

  it('steps the shortcut by one increment and persists the result', () => {
    const { preferences, getStored } = makePreferences(80)
    const win = {} as BrowserWindow

    increaseWindowOpacity(win, preferences)
    expect(preferences.setItem).toHaveBeenCalledWith('windowOpacity', 80 + WINDOW_OPACITY_STEP)
    expect(getStored()).toBe(85)

    decreaseWindowOpacity(win, preferences)
    expect(getStored()).toBe(80)
  })

  it('does not write past the bounds', () => {
    const maximum = makePreferences(WINDOW_OPACITY_MAX)
    increaseWindowOpacity({} as BrowserWindow, maximum.preferences)
    expect(maximum.preferences.setItem).not.toHaveBeenCalled()

    const minimum = makePreferences(WINDOW_OPACITY_MIN)
    decreaseWindowOpacity({} as BrowserWindow, minimum.preferences)
    expect(minimum.preferences.setItem).not.toHaveBeenCalled()
  })
})
