import { describe, it, expect } from 'vitest'
import { shouldShowInAppTitle } from '@/components/titleBar/visibility'

// #4210: with the native title bar (non-macOS, `frame: true`), the OS draws a
// title bar showing document.title AND the in-app title bar rendered the same
// filename — the title appeared twice. Only the in-app filename is hidden; the
// bar itself stays because it also hosts the word counter. On macOS the window
// is always frameless, so the in-app filename must still show.
describe('shouldShowInAppTitle (#4210)', () => {
  it('hides the in-app title for the native style on non-macOS', () => {
    expect(shouldShowInAppTitle('native', false)).toBe(false)
  })

  it('still shows the in-app title on macOS even with the native style', () => {
    expect(shouldShowInAppTitle('native', true)).toBe(true)
  })

  it('shows the in-app title for the custom style', () => {
    expect(shouldShowInAppTitle('custom', false)).toBe(true)
  })
})
