import pathe from 'pathe'
import * as win32 from '@jsr/std__path/windows'

// Node-`path`-shaped module. The sandboxed renderer and its preload cannot load
// node's `path`, and a POSIX-only shim (`pathe`) makes the renderer build `/`
// paths while the watcher, the main process and the OS shell use `\` on
// Windows. Picking the real win32 implementation keeps a single path
// representation (#5683).
export interface PlatformPath {
  basename(path: string, ext?: string): string
  dirname(path: string): string
  extname(path: string): string
  join(...paths: string[]): string
  resolve(...paths: string[]): string
  relative(from: string, to: string): string
  isAbsolute(path: string): boolean
  normalize(path: string): string
  parse(path: string): { root: string, dir: string, base: string, ext: string, name: string }
  format(pathObject: {
    root?: string
    dir?: string
    base?: string
    ext?: string
    name?: string
  }): string
  sep: string
  delimiter: string
}

const posixPath: PlatformPath = {
  basename: (path, ext) => pathe.basename(path, ext),
  dirname: (path) => pathe.dirname(path),
  extname: (path) => pathe.extname(path),
  join: (...paths) => pathe.join(...paths),
  resolve: (...paths) => pathe.resolve(...paths),
  relative: (from, to) => pathe.relative(from, to),
  isAbsolute: (path) => pathe.isAbsolute(path),
  normalize: (path) => pathe.normalize(path),
  parse: (path) => pathe.parse(path),
  format: (pathObject) => pathe.format(pathObject),
  sep: pathe.sep,
  delimiter: pathe.delimiter
}

const win32Path: PlatformPath = {
  basename: (path, ext) => win32.basename(path, ext),
  dirname: (path) => win32.dirname(path),
  extname: (path) => win32.extname(path),
  join: (...paths) => win32.join(...paths),
  resolve: (...paths) => win32.resolve(...paths),
  relative: (from, to) => win32.relative(from, to),
  isAbsolute: (path) => win32.isAbsolute(path),
  normalize: (path) => win32.normalize(path),
  parse: (path) => win32.parse(path),
  format: (pathObject) => win32.format(pathObject),
  sep: win32.SEPARATOR,
  delimiter: win32.DELIMITER
}

export const createPlatformPath = (isWindows: boolean): PlatformPath =>
  isWindows ? win32Path : posixPath
