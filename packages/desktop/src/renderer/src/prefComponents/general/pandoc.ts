import type { PandocCommandInfo } from '@shared/types/pandoc'

export interface PandocSwitch {
  /** i18n key of the note beside the switch, empty while detection has not answered. */
  note: string
  /** `{path}` for the note, empty when no binary could be named. */
  path: string
  disabled: boolean
}

/**
 * A machine without pandoc greys the switch out, unless it is already on — that switch is
 * the only way back out once the binary goes away.
 */
export const pandocSwitchState = (
  probe: PandocCommandInfo | null,
  switchOn: boolean
): PandocSwitch => {
  // `null` means detection has not answered: claim nothing and grey nothing.
  if (!probe) return { note: '', path: '', disabled: false }
  const path = probe.command ?? ''
  if (path) return { note: 'preferences.general.pandoc.found', path, disabled: false }
  return { note: 'preferences.general.pandoc.notFound', path: '', disabled: !switchOn }
}
