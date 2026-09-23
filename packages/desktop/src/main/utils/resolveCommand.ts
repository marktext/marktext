import path from 'path'
import fs from 'fs-extra'
import commandExists from 'command-exists'
import { extraPathDirs } from '../app/envPath'

// A PATH lookup answers "no such command" for anything it could not run, so
// the fallback below has to hold the same bar: a directory bearing the name, or
// a file without the executable bit, would otherwise pass the check and then
// fail the spawn with EACCES/EISDIR.
const isRunnable = (candidate: string): boolean => {
  try {
    if (!fs.statSync(candidate).isFile()) return false
    fs.accessSync(candidate, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * How `name` should be spawned on this machine, or null when it is not
 * installed. A bare name means PATH already resolves it; otherwise it is the
 * absolute path within a bin dir PATH does not cover. The "is it installed?"
 * check and the spawn share this one answer so they cannot disagree (#5518).
 *
 * Reads PATH as it stands at the call, so a caller that wants the login shell's
 * dirs counted must await `ensureShellEnvPath()` first.
 */
export const resolveCommandPath = (name: string): string | null => {
  const names = process.platform === 'win32' ? [name, `${name}.exe`] : [name]
  for (const candidate of names) {
    try {
      if (commandExists.sync(candidate)) return candidate
    } catch {
      /* not on PATH */
    }
  }

  // Windows GUI apps start with the user's own PATH, so a miss there is a real
  // miss; `extraPathDirs` is empty for it anyway.
  for (const dir of extraPathDirs(process.platform, process.env)) {
    const candidate = path.join(dir, name)
    if (isRunnable(candidate)) return candidate
  }
  return null
}
