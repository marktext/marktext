import { spawn } from 'child_process'
import RipgrepDirectorySearcher from './ripgrepSearcher'

// Use ripgrep searcher to search for files on disk only.
class FileSearcher extends RipgrepDirectorySearcher {
  searchInDirectory (directoryPath, pattern, options, numPathsFound) {
    const args = ['--files']

    if (options.followSymlinks) {
      args.push('--follow')
    }
    if (options.includeHidden) {
      args.push('--hidden')
    }
    if (options.noIgnore) {
      args.push('--no-ignore')
    }

    for (const inclusion of this.prepareGlobs(options.inclusions, directoryPath)) {
      args.push('--iglob', inclusion)
    }

    args.push('--')
    args.push(directoryPath)

    let child = null
    try {
      child = spawn(this.rgPath, args, {
        cwd: directoryPath,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      return Promise.reject(err)
    }

    const didMatch = options.didMatch || (() => {})
    let cancelled = false

    const returnedPromise = new Promise((resolve, reject) => {
      let buffer = ''
      let bufferError = ''

      child.on('close', (code, signal) => {
        // code 1 is used when no results are found.
        if (code !== null && code > 1) {
          reject(new Error(bufferError))
        } else {
          resolve()
        }
      })
      child.on('error', err => {
        reject(err)
      })

      child.stderr.on('data', chunk => {
        bufferError += chunk
      })

      child.stdout.on('data', chunk => {
        if (cancelled) {
          return
        }

        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          options.didSearchPaths(++numPathsFound.num)
          didMatch(line)
        }
      })
    })

    returnedPromise.cancel = () => {
      child.kill()
      cancelled = true
    }

    return returnedPromise
  }
}

export default FileSearcher
