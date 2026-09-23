import { createHash, randomUUID } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { readlinkSync, ensureDir, pathExists, rename, rm, unlink } from 'fs-extra'
import path from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import writeFileAtomic from 'write-file-atomic'
import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

/**
 * Normalize the path into an absolute path and resolves the link target if needed.
 *
 * Returns the absolute path and resolved link, or an empty string if the link
 * target cannot be resolved.
 */
export const normalizeAndResolvePath = (pathname: string): string => {
  if (isSymbolicLink(pathname)) {
    const absPath = path.dirname(pathname)
    const targetPath = path.resolve(absPath, readlinkSync(pathname))
    if (isFile(targetPath) || isDirectory(targetPath)) {
      return path.resolve(targetPath)
    }
    console.error(`Cannot resolve link target "${pathname}" (${targetPath}).`)
    return ''
  }
  return path.resolve(pathname)
}

/**
 * Splits a link destination such as `other.md#setup` into the file path and the
 * fragment. The path is percent-decoded (CommonMark #503, #57) and resolved
 * against `dirname` (`''` for an unsaved document); the anchor is returned as
 * written. A `#` belonging to an existing file name (`C#.md`) stays in the path.
 * A target that is not valid percent-encoding is used as written (#4749).
 */
export const resolveLocalLinkTarget = (
  link: string,
  dirname: string
): { pathname: string; anchor: string } => {
  const toPathname = (target: string): string => {
    // Only the target is decoded: it comes from the document as URL-encoded text,
    // whereas `dirname` is a raw filesystem path that may legally contain `%`. This
    // mirrors the renderer's `encodeDirnameForUrl` (#5212). `isAbsolute` still tests
    // the encoded target so a `%2F` cannot turn a relative link into an absolute one.
    let decoded = target
    try {
      decoded = decodeURIComponent(target)
    } catch {
      // Not valid percent-encoding (e.g. `bad%zz.md`): `%` is a legal filename
      // character, so use the target as written instead of throwing out of the
      // `mt::format-link-click` handler (#4749).
    }
    const joined = dirname && !path.isAbsolute(target) ? path.join(dirname, decoded) : decoded
    return path.normalize(joined)
  }

  const pathname = toPathname(link)
  const hashIndex = link.indexOf('#')
  if (hashIndex <= 0 || isFile(pathname)) {
    return { pathname, anchor: '' }
  }
  return { pathname: toPathname(link.slice(0, hashIndex)), anchor: link.slice(hashIndex + 1) }
}

/**
 * Copies `src` into the existing `outputDir` as `<SHA-1 of its bytes><ext>` and
 * returns the destination. The source is hashed while it is copied, so it is
 * read only once; if an identical file is already there it is kept and the new
 * copy is discarded.
 */
export const copyFileWithContentHash = async(src: string, outputDir: string): Promise<string> => {
  const hash = createHash('sha1')
  const tempPath = path.join(outputDir, `.${randomUUID()}.tmp`)
  try {
    await pipeline(
      createReadStream(src),
      new Transform({
        transform(chunk, _encoding, callback) {
          hash.update(chunk)
          callback(null, chunk)
        }
      }),
      createWriteStream(tempPath, { flags: 'wx' })
    )
    const dest = path.join(outputDir, `${hash.digest('hex')}${path.extname(src)}`)
    if (await pathExists(dest)) {
      await unlink(tempPath)
    } else {
      await rename(tempPath, dest)
    }
    return dest
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}

export const writeFile = async(
  pathname: string,
  content: string | Buffer,
  extension?: string,
  options: BufferEncoding | undefined = 'utf-8'
): Promise<void> => {
  if (!pathname) {
    return Promise.reject(new Error('[ERROR] Cannot save file without path.'))
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  // write-file-atomic does not create parent directories; recreate a moved or
  // deleted folder first so an (auto)save into it still succeeds (#3509).
  // Only do this when the parent does not already exist. On Windows fs.mkdir
  // returns EPERM (not EEXIST) for an existing volume root (e.g. "E:\"), so for
  // an existing parent — drive roots included — ensureDir would throw and block
  // saving directly to a drive root instead of being a harmless no-op (#5150).
  const dir = path.dirname(pathname)
  if (!isDirectory(dir)) {
    await ensureDir(dir)
  }

  // Durable atomic save: write to a temp file in the target's directory, fsync
  // it, then rename it over the target. This survives an application crash AND
  // a power loss / OS reboot — the fsync before the rename is what closes the
  // power-loss window that otherwise leaves a full-length, zero-filled file
  // (#3786, #3828); a bare rename is only namespace-atomic, not data-durable.
  // write-file-atomic also preserves the target's mode/owner, writes through a
  // symlink to its target, and uses a unique temp name — all of which a plain
  // temp+rename dropped.
  await writeFileAtomicWithRetry(pathname, content, options)
}

// Windows refuses MoveFileEx(REPLACE_EXISTING) — what the atomic save's rename
// compiles to — with ACCESS_DENIED, surfaced as EPERM, whenever ANY handle is
// open on the target. Measured: that holds on local NTFS as much as on a share,
// and whether or not the holder asked for FILE_SHARE_DELETE. What decides
// whether it bites is how long the handle stays open: our own file watcher
// stats the open document, and a stat over SMB is a network round trip instead
// of the microseconds it costs locally, so on a share the save keeps losing the
// race with its own watcher (#5322). Measured over SMB: watcher polling loses
// ~1 save in 200, worse the faster it stats; a handle held open loses every
// one. That handle is released within milliseconds, so a short backoff clears
// the race. A process holding the file open continuously (a scanner, a sync
// client) is out of reach of any retry — on a local disk as much as a share.
const RENAME_RACE_CODES = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RENAME_RETRY_DELAYS_MS = [50, 150, 300]

const writeFileAtomicWithRetry = async(
  pathname: string,
  content: string | Buffer,
  options: BufferEncoding | undefined
): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await writeFileAtomic(pathname, content, options)
      return
    } catch (error) {
      const { code } = error as NodeJS.ErrnoException
      if (attempt >= RENAME_RETRY_DELAYS_MS.length || !code || !RENAME_RACE_CODES.has(code)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, RENAME_RETRY_DELAYS_MS[attempt]))
    }
  }
}
