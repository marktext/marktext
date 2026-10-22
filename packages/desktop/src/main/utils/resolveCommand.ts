import path from 'path'
import commandExists from 'command-exists'
import { isExecutableFile } from 'common/filesystem'
import { ensureShellEnvPath, extraPathDirs } from '../app/envPath'

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
    if (isExecutableFile(candidate)) return candidate
  }
  return null
}

interface ResolveCommandOptions {
  /** A path the user told us to use. Set but unusable resolves to null. */
  override?: string
  /** Absolute paths to try before PATH — an installer's own folder. */
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
  { override, preferred = [] }: ResolveCommandOptions = {}
): Promise<string | null> => {
  // An override is an instruction. Falling through to a copy the user did not
  // name would run the wrong binary and call it success.
  if (override) return isExecutableFile(override) ? override : null
  const found = preferred.find(isExecutableFile) ?? lookup(name)
  if (found) return found
  await ensureShellEnvPath()
  return lookup(name)
}
