/** What main reported about the binary an export would spawn; `null` until it answers. */
export interface PandocProbe {
  command: string | null
  onPath: boolean
}

export interface PandocSwitch {
  /** i18n key of the note beside the switch, empty while detection has not answered. */
  note: string
  /** `{path}` for the note, empty when it does not name a file. */
  path: string
  disabled: boolean
}

/**
 * A machine without pandoc gets the switch greyed out, unless it is already on — that
 * switch is the only way back out once the binary goes away.
 */
export const pandocSwitchState = (probe: PandocProbe | null, switchOn: boolean): PandocSwitch => {
  // `null` means detection has not answered: claim nothing and grey nothing.
  if (!probe) return { note: '', path: '', disabled: false }
  if (probe.onPath) {
    return { note: 'preferences.general.pandoc.foundOnPath', path: '', disabled: false }
  }
  const path = probe.command ?? ''
  return {
    note: path ? 'preferences.general.pandoc.found' : 'preferences.general.pandoc.notFound',
    path,
    disabled: !path && !switchOn
  }
}
