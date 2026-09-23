import path from 'path'
import fs from 'fs'
import commandExists from 'command-exists'
import { ensureShellEnvPath, extraPathDirs } from '../app/envPath'

// The same bar a PATH lookup holds, or the check passes and the spawn fails
// with EISDIR/EACCES.
const isRunnable = (candidate: string): boolean => {
  try {
    if (!fs.statSync(candidate).isFile()) return false
    fs.accessSync(candidate, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

// The name comes from the renderer over IPC. `commandExists.sync('')` answers
// true, and `../../bin/sh` would join its way out of the dirs searched below.
const isCommandName = (name: string): boolean =>
  !!name.trim() && !name.includes('/') && !name.includes(path.sep)

const lookup = (name: string): string | null => {
  if (!isCommandName(name)) return null
  if (commandExists.sync(name)) return name

  // Second layer: `patchEnvPath` normally has these on PATH already, so this
  // only does work when PATH was never patched.
  for (const dir of extraPathDirs(process.platform, process.env)) {
    const candidate = path.join(dir, name)
    if (isRunnable(candidate)) return candidate
  }
  return null
}

export interface ResolveCommandOptions {
  /** Absolute paths to try first — an installer's own folder, a user override. */
  preferred?: string[]
}

/**
 * How `name` should be spawned, or null when it is not installed. The "is it
 * installed?" check and the spawn share this one answer so they cannot
 * disagree (#5518). The login shell is awaited here rather than left to each
 * caller to remember, and only once PATH as it stands has missed.
 */
export const resolveCommand = async(
  name: string,
  { preferred = [] }: ResolveCommandOptions = {}
): Promise<string | null> => {
  const override = preferred.find(isRunnable)
  if (override) return override
  const found = lookup(name)
  if (found) return found
  await ensureShellEnvPath()
  return lookup(name)
}
