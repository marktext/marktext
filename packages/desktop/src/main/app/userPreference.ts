import type Preference from '../preferences'

/**
 * The active preferences instance, for modules that are not constructed with it.
 *
 * `Accessor` builds `Preference` and injects it into the window manager, the
 * menu and the data center, but a few modules are reached through a plain
 * function import instead — the pandoc helper and the menu actions both run
 * from a click. Those need to read a setting when the user acts, not when the
 * module loads, so they read it from here.
 *
 * Set once from `main/index.ts` right after the accessor exists; reading before
 * that returns `null`, which every caller treats as "not configured yet".
 */
let instance: Preference | null = null

export const setUserPreference = (preference: Preference): void => {
  instance = preference
}

export const getUserPreference = (): Preference | null => instance
