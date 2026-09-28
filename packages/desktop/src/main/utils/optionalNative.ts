/**
 * Optional native-module loader.
 *
 * keytar / ced / native-keymap need a C++ toolchain at install time. When the
 * .node binary is missing the whole main process used to die on import; these
 * helpers let the app boot and degrade that one feature instead.
 */

export function tryRequire<T>(name: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name) as T
  } catch (err) {
    console.warn(`[marktext] optional native module unavailable: ${name}`, err)
    return null
  }
}
