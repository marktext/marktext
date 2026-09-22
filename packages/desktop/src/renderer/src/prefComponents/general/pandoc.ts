/** What main reported about the binary an export would spawn; `null` until it answers. */
export interface PandocProbe {
  command: string | null
  onPath: boolean
}

export interface PandocSwitch {
  /** i18n key of the note beside the switch. */
  note: string
  /** `{path}` for the note, empty when it does not name a file. */
  path: string
  disabled: boolean
}

/**
 * A machine without pandoc gets the switch greyed out, unless it is already on — that
 * switch is the only way back out once the binary goes away. `null` means detection has
 * not answered yet, and nothing is greyed until it does.
 */
export const pandocSwitchState = (probe: PandocProbe | null, switchOn: boolean): PandocSwitch => {
  const path = probe?.command ?? ''
  const onPath = Boolean(probe?.onPath)
  let note = 'preferences.general.pandoc.found'
  if (onPath) note = 'preferences.general.pandoc.foundOnPath'
  else if (!path) note = 'preferences.general.pandoc.notFound'
  return {
    note,
    path: onPath ? '' : path,
    disabled: probe !== null && !path && !switchOn
  }
}
