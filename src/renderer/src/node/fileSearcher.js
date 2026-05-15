class FileSearcher {
  constructor () {
    this.rgPath = window.marktext.paths.ripgrepBinaryPath
  }

  search (directories, pattern, options) {
    const numPathsFound = { num: 0 }

    const allPromises = directories.map((directory) =>
      this.searchInDirectory(directory, pattern, options, numPathsFound)
    )

    const promise = Promise.all(allPromises)
    promise.cancel = () => {
      // File search via IPC is not cancellable after dispatch
    }
    return promise
  }

  async searchInDirectory (directoryPath, pattern, options, numPathsFound) {
    const didMatch = options.didMatch || (() => {})

    const results = await window.execAPI.ripgrepFileSearch({
      rgPath: this.rgPath,
      directoryPath,
      options: {
        followSymlinks: options.followSymlinks,
        includeHidden: options.includeHidden,
        noIgnore: options.noIgnore,
        inclusions: options.inclusions || []
      }
    })

    for (const line of results) {
      options.didSearchPaths(++numPathsFound.num)
      didMatch(line)
    }
  }
}

export default FileSearcher
