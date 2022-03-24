import { hasMarkdownExtension } from 'common/filesystem/paths'
import { WATCHER_STABILITY_THRESHOLD, WATCHER_STABILITY_POLL_INTERVAL } from 'common/filesystem/watcher'
import { isOsx } from '../../config'

const isPathIgnored = fullPath => {
  return /(?:^|[/\\])(?:\..|node_modules|(?:.+\.asar))/.test(fullPath)
}

const getMarkdownBaseWatcherConfig = usePolling => {
  return {
    ignored: (pathname, fileInfo) => {
      // This function is called twice, once with a single argument (the path),
      // second time with two arguments (the path and the "fs.Stats" object of that path).
      if (!fileInfo) {
        return isPathIgnored(pathname)
      }

      if (isPathIgnored(pathname)) {
        return true
      }
      if (fileInfo.isDirectory()) {
        return false
      }
      return !hasMarkdownExtension(pathname)
    },

    ignoreInitial: true,
    persistent: true,
    ignorePermissionErrors: true,
    disableGlobbing: true,

    alwaysStat: false,
    followSymlinks: true,

    // Push file modifications only after given threshold (GH#1043).
    awaitWriteFinish: {
      stabilityThreshold: WATCHER_STABILITY_THRESHOLD,
      pollInterval: WATCHER_STABILITY_POLL_INTERVAL
    },

    // Polling shouldn't be use, but it may required on network drives. Also
    // just in case, set a high fallback value.
    usePolling,
    interval: usePolling ? 500 : 5000,
    binaryInterval: 5000
  }
}

export const getMarkdownFileWatcherConfig = config => {
  const { usePolling } = config
  return Object.assign({}, getMarkdownBaseWatcherConfig(usePolling), {
    // Always emit with stat information because we need the last modification time.
    alwaysStat: true,
    // Don't watch recursive if a file is replaced by a directory.
    depth: isOsx ? 1 : 0
  })
}

export const getMarkdownDirectoryWatcherConfig = config => {
  const { directoryDepth, usePolling } = config
  return Object.assign({}, getMarkdownBaseWatcherConfig(usePolling), {
    depth: directoryDepth
  })
}
