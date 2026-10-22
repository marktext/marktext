import path from 'path'
import fs from 'fs-extra'

// Outside test/unit/specs/ so the vitest glob does not collect it as a suite.

/** A 1x1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/** A login shell that evaluates the command with `shellPath`. */
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

/** An executable that prints picgo's success format. */
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

/** `process.platform` is read-only, so it takes a defineProperty. */
export const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true })
}

/** Plain assignment would write the string 'undefined' when it was unset. */
export const restoreEnv = (name: string, original: string | undefined): void => {
  if (original === undefined) delete process.env[name]
  else process.env[name] = original
}
