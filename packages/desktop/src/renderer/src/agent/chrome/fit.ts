// The text column is `--editorAreaWidth` (750). The pane stays at least 820
// so that column is the last thing to shrink: the agent panel gives way first.
export const TEXT_COLUMN_MIN = 750
export const EDITOR_PANE_MIN = 820
export const AGENT_PANEL_MIN = 280
export const AGENT_PANEL_MAX = 480
export const AGENT_PANEL_DEFAULT = 320
export const AGENT_RAIL_WIDTH = 45
export const TERMINAL_HEIGHT_MIN = 120
export const TERMINAL_HEIGHT_DEFAULT = 220
export const TERMINAL_HEIGHT_MAX_RATIO = 0.55
export const TERMINAL_COLLAPSE_BELOW = 48

export interface AgentPanelFit {
  width: number
  rail: boolean
  editorWidth: number
  /** Pixels still needed before the stored panel width fits beside the text. */
  deficit: number
}

export const fitAgentPanel = (input: {
  windowWidth: number
  sideBarWidth: number
  requestedWidth: number
  shown: boolean
}): AgentPanelFit => {
  const side = Math.max(0, input.sideBarWidth)
  const requested = input.requestedWidth
  const editorAt = (agentWidth: number): number =>
    Math.max(0, input.windowWidth - side - agentWidth)

  if (!input.shown) {
    return { width: 0, rail: false, editorWidth: editorAt(0), deficit: 0 }
  }

  let width = requested
  let rail = false
  if (editorAt(width) < EDITOR_PANE_MIN) {
    const room = input.windowWidth - side - EDITOR_PANE_MIN
    if (room >= AGENT_PANEL_MIN) {
      width = Math.min(requested, room)
    } else {
      rail = true
      width = AGENT_RAIL_WIDTH
    }
  }

  const deficit = rail
    ? Math.max(0, side + EDITOR_PANE_MIN + requested - input.windowWidth)
    : 0

  return { width, rail, editorWidth: editorAt(width), deficit }
}

export const clampTerminalHeight = (height: number, viewportHeight: number): number => {
  const max = Math.max(
    TERMINAL_HEIGHT_MIN,
    Math.round(viewportHeight * TERMINAL_HEIGHT_MAX_RATIO)
  )
  return Math.min(max, Math.max(TERMINAL_HEIGHT_MIN, height))
}
