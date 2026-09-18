import pandoc from '../utils/pandoc'

/**
 * Whether a usable pandoc was found on this machine.
 *
 * `null` means "not checked yet", and an unchecked state counts as available:
 * nothing has been tried, so greying the pandoc entries out would hide a
 * working install from every user until the first check happens to run.
 */
let available: boolean | null = null

let onAvailabilityChanged: (() => void) | null = null

/**
 * Register what to do when the answer changes — the menus carry the pandoc
 * entries and have to be rebuilt from the template.
 */
export const setPandocAvailabilityListener = (listener: () => void): void => {
  onAvailabilityChanged = listener
}

/** Unchecked counts as available; see above. */
export const isPandocAvailable = (): boolean => available !== false

/**
 * Record the outcome of a check (`pandoc --version`).
 *
 * Uses a real check rather than `pandoc.exists()`: the latter trusts any
 * user-configured path without looking at it, so a typo would still count as
 * available until the first export failed.
 */
export const setPandocAvailable = (ok: boolean): void => {
  if (ok === available) {
    return
  }
  available = ok
  onAvailabilityChanged?.()
}

/**
 * How long a refresh waits before it runs.
 *
 * The preferences page writes on every keystroke, so re-checking on each
 * `pandocPath` change would start one `pandoc --version` per character typed
 * into the path field. Waiting a moment lets a burst collapse into one check.
 */
const REFRESH_DELAY = 300

let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Run the check against the command an export would use.
 *
 * `pandoc.check` resolves with `ok: false` instead of rejecting, so there is
 * nothing to catch here.
 */
const runCheck = async(): Promise<void> => {
  const { ok } = await pandoc.check()
  setPandocAvailable(ok)
}

/**
 * Ask for the check to run, coalescing bursts.
 *
 * Callers ignore the result: this is a background refresh that only shows up as
 * the menu entries changing, and the answer starts out as "available" — see the
 * note on `available`.
 */
export const refreshPandocAvailability = (): void => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    runCheck()
  }, REFRESH_DELAY)
}
