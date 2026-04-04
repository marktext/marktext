/**
 * Shared debug logging state for the renderer process.
 * This module provides a simple getter/setter for the debug log flag
 * that both renderers/index.js and parser/render/index.js can check.
 */
let debugLogEnabled = false

export const isDebugLogEnabled = () => debugLogEnabled

export const setDebugLogEnabled = (enabled) => {
  debugLogEnabled = !!enabled
}
