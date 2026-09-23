import path from 'path'
import fs from 'fs'
import commandExists from 'command-exists'
import { ensureShellEnvPath, extraPathDirs } from '../app/envPath'

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

const lookup = (name: string): string | null => {
  // `commandExists.sync('')` answers true, and the name reaches us from the
  // renderer.
  if (!name.trim()) return null
  if (commandExists.sync(name)) return name

  // Second layer. `patchEnvPath` has normally put these on PATH already, so the
  // lookup above covers them — this still stands if PATH was never patched, and
  // is what the specs exercise. Empty on Windows, whose GUI apps inherit the
  // user's own PATH.
  for (const dir of extraPathDirs(process.platform, process.env)) {
    const candidate = path.join(dir, name)
    if (isRunnable(candidate)) return candidate
  }
  return null
}

/**
 * How `name` should be spawned on this machine, or null when it is not
 * installed. A bare name means PATH already resolves it; otherwise it is the
 * absolute path within a bin dir PATH does not cover. The "is it installed?"
 * check and the spawn share this one answer so they cannot disagree (#5518).
 *
 * Asking the login shell where the user's tools live is part of the answer, so
 * it is awaited here rather than left to each caller to remember — but only
 * once PATH as it stands has already missed, which costs nothing in the common
 * case.
 */
export const resolveCommand = async(name: string): Promise<string | null> => {
  const found = lookup(name)
  if (found) return found
  await ensureShellEnvPath()
  return lookup(name)
}
