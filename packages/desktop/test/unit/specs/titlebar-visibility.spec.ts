import { describe, it, expect } from 'vitest'
import { shouldShowInAppTitleBar } from '@/components/titleBar/visibility'

// #4210: with the native title bar (non-macOS, `frame: true`), the OS draws a
// title bar showing document.title AND the in-app custom title bar rendered the
// same filename — the title appeared twice. The in-app bar must be hidden when
// the native title bar is active. On macOS the window is always frameless, so
// the in-app bar must still show.
describe('shouldShowInAppTitleBar (#4210)', () => {
  it('hides the in-app title bar for the native style on non-macOS', () => {
    expect(shouldShowInAppTitleBar('native', false)).toBe(false)
  })

  it('still shows the in-app title bar on macOS even with the native style', () => {
    expect(shouldShowInAppTitleBar('native', true)).toBe(true)
  })

  it('shows the in-app title bar for the custom style', () => {
    expect(shouldShowInAppTitleBar('custom', false)).toBe(true)
  })
})
