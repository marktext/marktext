import { app } from 'electron'
import { editorWinOptions } from '../../../src/main/config'
import { ensureWindowPosition } from '../../../src/main/windows/utils'

export const windowPositionFixture = { editorWinOptions, ensureWindowPosition }
Object.assign(globalThis, { windowPositionFixture })

// Each test destroys its window; Playwright owns the harness lifetime.
app.on('window-all-closed', () => {})
