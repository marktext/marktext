import { KeyboardMapper } from './keymap'

// Conflict checks, recording and dispatch must observe the same active layout.
export const keyboardMapper = new KeyboardMapper(process.platform)
