/** Which pandoc an export would spawn, declared once for both processes. */
export interface PandocCommandInfo {
  /** Absolute path of the binary that would run, or `null` when none could be named. */
  command: string | null
}
