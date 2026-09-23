import path from 'path'
import { tmpdir } from 'os'
import { exec, execFile } from 'child_process'
import fs from 'fs-extra'
import { ipcMain } from 'electron'
import { isImageFile } from 'common/filesystem/paths'
import { ensureShellEnvPath } from '../app/envPath'
import { resolveCommandPath } from '../utils/resolveCommand'

// Strip ANSI SGR color codes (CSI parameter ... 'm') from picgo output before
// trying to parse it. \x1b is the ESC byte.
const ANSI_SGR_RE = /\x1b\[[0-9;]*m/g // eslint-disable-line no-control-regex

const parsePicgoOutput = (text: unknown): string | null => {
  const raw = String(text || '')
  const cleaned = raw.replace(ANSI_SGR_RE, '')
  try {
    const lines = cleaned
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    for (const line of lines) {
      if (
        (line.startsWith('{') && line.endsWith('}')) ||
        (line.startsWith('[') && line.endsWith(']'))
      ) {
        try {
          const obj = JSON.parse(line)
          if (obj) {
            if (obj.success === true && typeof obj.imgUrl === 'string') return obj.imgUrl
            if (obj.success === true && Array.isArray(obj.result) && obj.result.length > 0) {
              return String(obj.result[obj.result.length - 1])
            }
            if (obj.success === true && typeof obj.url === 'string') return obj.url
          }
        } catch {
          /* not JSON */
        }
      }
      const kv = line.match(/(?:success|succeeded|uploaded)\s*:?\s*(https?:\/\/\S+)/i)
      if (kv && kv[1]) return kv[1]
    }
  } catch {
    /* outer parse failed */
  }
  const marker = cleaned.split('[PicGo SUCCESS]:')
  if (marker.length >= 2) {
    const candidate = marker[marker.length - 1].trim()
    if (/^https?:\/\//i.test(candidate)) return candidate
  }
  return null
}

const uploadByPicgo = (localPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const cmd = resolveCommandPath('picgo')
    if (!cmd) return reject(new Error('PicGo command not found in PATH'))
    const done = (err: Error | null, stdout: string | Buffer, stderr: string | Buffer) => {
      if (err) return reject(err)
      const text = String(stdout || '') + (stderr ? `\n${String(stderr)}` : '')
      const url = parsePicgoOutput(text)
      if (url) resolve(url)
      else reject(new Error(`PicGo upload error: cannot parse output\n${text.slice(0, 400)}`))
    }
    if (process.platform === 'win32') {
      // Left exactly as it was, and still a shell: `picgo` here is a .cmd shim,
      // which execFile cannot start without a shell, and `shell: true` would be
      // worse (node joins argv with spaces and escapes nothing). A Windows
      // filename cannot contain `"`, so the quoting holds against the injection
      // this branch's POSIX sibling had; `%VAR%` still expands inside quotes
      // though, so a name like `%TEMP%.png` is mangled. Fixing that needs real
      // .exe-vs-.cmd resolution and a Windows machine to verify on.
      exec(`${cmd} u "${localPath}"`, done)
    } else {
      // Elsewhere the path goes through as its own argv entry, so quotes, `$`
      // and backticks in a filename reach picgo verbatim instead of being
      // re-interpreted by the shell.
      execFile(cmd, ['u', localPath], done)
    }
  })

const uploadByCli = (cliScript: string, localPath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(cliScript, [localPath], (err, data) => {
      if (err) return reject(err)
      resolve(String(data || '').trim())
    })
  })

// The file is written into a directory of its own: two clipboard images pasted
// in the same millisecond would otherwise land on the same `Date.now()` path,
// so one upload would send the other's bytes and the first one to finish would
// delete the file the second still needs. The basename stays timestamped
// because uploaders derive the remote filename from it.
const writeBinaryToTmp = async(
  data: Uint8Array | number[] | null | undefined,
  suffix: string = ''
): Promise<string> => {
  const buf = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(data || [])
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'marktext-upload-'))
  const tmpPath = path.join(dir, `${Date.now()}${suffix}`)
  await fs.writeFile(tmpPath, buf)
  return tmpPath
}

const uploadFromPath = async(
  imagePath: string,
  options: { currentUploader: string; cliScript: string }
): Promise<string> => {
  const { currentUploader, cliScript } = options
  if (currentUploader === 'picgo') return uploadByPicgo(imagePath)
  if (currentUploader === 'cliScript') return uploadByCli(cliScript, imagePath)
  throw new Error(`Unsupported uploader: ${currentUploader}`)
}

interface BufferImagePayload {
  data: Uint8Array | number[]
  name: string
}

const uploadFromBuffer = async(
  { data, name }: BufferImagePayload,
  options: {
    currentUploader: string
    cliScript: string
  }
): Promise<string> => {
  const { currentUploader, cliScript } = options
  const suffix = path.extname(name || '') || ''
  const localPath = await writeBinaryToTmp(data, suffix)
  const cleanup = () =>
    fs.remove(path.dirname(localPath)).catch(() => {
      /* ignore */
    })
  try {
    if (currentUploader === 'picgo') return await uploadByPicgo(localPath)
    if (currentUploader === 'cliScript') return await uploadByCli(cliScript, localPath)
    throw new Error(`Unsupported uploader: ${currentUploader}`)
  } finally {
    await cleanup()
  }
}

interface UploadRequest {
  pathname: string
  image: string | BufferImagePayload
  isPath: boolean
  preferences: { currentUploader: string; cliScript: string }
}

export const registerUploaderHandlers = (): void => {
  ipcMain.handle('mt::uploader::upload', async(_event, req: UploadRequest) => {
    // The uploader is a command the user installed, so it may live somewhere
    // only their login shell knows about (#5518).
    await ensureShellEnvPath()
    const { pathname, image, isPath, preferences } = req
    if (isPath) {
      const dir = path.dirname(pathname)
      const imagePath = path.resolve(dir, image as string)
      const isImg = isImageFile(imagePath)
      if (!isImg) return image
      return uploadFromPath(imagePath, preferences)
    }
    return uploadFromBuffer(image as BufferImagePayload, preferences)
  })
}
