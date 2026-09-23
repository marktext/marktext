import path from 'path'
import fs from 'fs-extra'
import commandExists from 'command-exists'
import { extraPathDirs } from '../app/envPath'

/**
 * How `name` should be spawned on this machine, or null when it is not
 * installed. A bare name means PATH already resolves it; otherwise it is the
 * absolute path within a bin dir PATH does not cover. The "is it installed?"
 * check and the spawn share this one answer so they cannot disagree (#5518).
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
    try {
      if (fs.pathExistsSync(candidate)) return candidate
    } catch {
      /* unreadable dir */
    }
  }
  return null
}
