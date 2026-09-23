import path from 'path'
import fs from 'fs-extra'

// Fixtures shared by the #5518 specs. This file sits outside test/unit/specs/
// so vitest's include glob does not collect it as a suite.

/** A 1x1 PNG, enough for an uploader to be handed real image bytes. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/**
 * A stand-in for the user's login shell: it evaluates the command it is handed
 * with `shellPath`, which is how a dir the GUI process cannot see still reaches
 * the code under test. `record`, when given, gets a line per run.
 */
export const writeFakeShell = async(
  file: string,
  shellPath: string,
  options: { record?: string; before?: string[] } = {}
): Promise<string> => {
  const { record, before = [] } = options
  await fs.writeFile(
    file,
    [
      '#!/bin/sh',
      ...(record ? [`printf 'ran\\n' >> "${record}"`] : []),
      ...before,
      'for a in "$@"; do last="$a"; done',
      `PATH="${shellPath}" /bin/sh -c "$last"`
    ].join('\n') + '\n',
    { mode: 0o755 }
  )
  return file
}

/** An executable that prints picgo's success format and exits. */
export const writeFakePicgo = async(dir: string, name = 'picgo'): Promise<string> => {
  const file = path.join(dir, name)
  await fs.writeFile(
    file,
    ['#!/bin/sh', 'echo "[PicGo SUCCESS]: "', 'echo "https://cdn.example.com/uploaded.png"'].join(
      '\n'
    ) + '\n',
    { mode: 0o755 }
  )
  return file
}

/** Swap `process.platform`, which is read-only, for the length of a spec. */
export const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true })
}

/** Restore an env var, including the case where it was not set to begin with. */
export const restoreEnv = (name: string, original: string | undefined): void => {
  if (original === undefined) delete process.env[name]
  else process.env[name] = original
}
