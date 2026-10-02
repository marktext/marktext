import fs from 'fs'
import path from 'path'
import { isExecutableFile } from 'common/filesystem'

export interface HarnessSpawn {
  /** Passed to `spawn` as the executable. `cmd.exe` for a Windows batch file. */
  command: string
  args: string[]
  /** The file PATH or the setting named, before any `cmd.exe` wrapper. */
  resolvedPath: string
}

export type ResolveHarnessResult =
  | ({ ok: true } & HarnessSpawn)
  | { ok: false, reason: 'not_found' }
  | { ok: false, reason: 'not_executable', resolvedPath: string }

const BATCH_EXT = /\.(cmd|bat)$/i

const isCommandName = (name: string): boolean =>
  !!name.trim() && !name.includes('/') && !name.includes('\\')

/**
 * One argv element for `cmd.exe /d /s /c`. `%` is doubled so cmd does not
 * expand it; metacharacters are quoted with the CreateProcess backslash rules.
 */
export const quoteCmdArg = (value: string): string => {
  const escaped = value.replace(/%/g, '%%')
  if (escaped.length === 0) return '""'
  if (!/[\s"&<>()@^|!]/.test(escaped)) return escaped
  const quoted = escaped
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/, '$1$1')
  return `"${quoted}"`
}

/**
 * `.cmd` / `.bat` cannot be the `spawn` file (`EINVAL`). `/s` strips one
 * leading and one trailing quote, so the inner quoting survives. This is
 * not `shell: true`: the shell would re-split the line.
 */
export const windowsBatchSpawn = (
  filePath: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv
): { command: string, args: string[] } => {
  const inner = [filePath, ...args].map(quoteCmdArg).join(' ')
  const commandLine = `"${inner}"`
  const comspec = env.ComSpec?.trim() ? env.ComSpec : 'cmd.exe'
  return { command: comspec, args: ['/d', '/s', '/c', commandLine] }
}

export const spawnForResolved = (
  resolvedPath: string,
  args: readonly string[],
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv
): { command: string, args: string[] } => {
  if (platform === 'win32' && BATCH_EXT.test(resolvedPath)) {
    return windowsBatchSpawn(resolvedPath, args, env)
  }
  return { command: resolvedPath, args: [...args] }
}

const pathValueOf = (env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string => {
  if (platform === 'win32') return env.Path ?? env.PATH ?? ''
  return env.PATH ?? env.Path ?? ''
}

/**
 * Extensions tried after the bare name. The bare name stays first so an
 * exact `opencode` wins over `opencode.cmd` when both exist.
 */
const pathExtensions = (env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] => {
  if (platform !== 'win32') return ['']
  const listed = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0)
  return ['', ...listed]
}

const lookupOnPath = (
  command: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): string | null => {
  if (!isCommandName(command)) return null
  const dirs = pathValueOf(env, platform).split(path.delimiter).filter((dir) => dir.length > 0)
  for (const dir of dirs) {
    for (const ext of pathExtensions(env, platform)) {
      const candidate = path.join(dir, command + ext)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return null
}

const fileExists = (filePath: string): boolean => {
  try {
    fs.statSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * `configuredPath` empty means `defaultCommand` on PATH (PATHEXT on Windows).
 * A set path that is missing does not fall through to PATH.
 */
export const resolveHarnessCommand = (
  defaultCommand: string,
  defaultArgs: readonly string[],
  configuredPath: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): ResolveHarnessResult => {
  const configured = configuredPath.trim()
  let resolvedPath: string
  if (configured) {
    if (!fileExists(configured)) return { ok: false, reason: 'not_found' }
    if (!isExecutableFile(configured)) {
      return { ok: false, reason: 'not_executable', resolvedPath: configured }
    }
    resolvedPath = configured
  } else {
    const found = lookupOnPath(defaultCommand, env, platform)
    if (!found) return { ok: false, reason: 'not_found' }
    resolvedPath = found
  }
  return {
    ok: true,
    resolvedPath,
    ...spawnForResolved(resolvedPath, defaultArgs, platform, env)
  }
}
