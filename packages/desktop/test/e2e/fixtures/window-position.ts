import { app } from 'electron'
import { editorWinOptions } from '../../../src/main/config'
import { fitWindowGeometry } from '../../../src/main/applicationState/windowGeometry'

export const windowPositionFixture = { editorWinOptions, fitWindowGeometry }
Object.assign(globalThis, { windowPositionFixture })

// Each test destroys its window; Playwright owns the harness lifetime.
app.on('window-all-closed', () => {})
