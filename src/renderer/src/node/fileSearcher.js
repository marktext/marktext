class FileSearcher {
  search (directories, pattern, options) {
    const numPathsFound = { num: 0 }
    const searchIds = []

    const allPromises = directories.map((directory) =>
      this.searchInDirectory(directory, pattern, options, numPathsFound, searchIds)
    )

    const promise = Promise.all(allPromises)
    promise.cancel = () => {
      for (const id of searchIds) {
        window.execAPI.cancelRipgrep(id)
      }
    }
    return promise
  }

  async searchInDirectory (directoryPath, pattern, options, numPathsFound, searchIds) {
    const didMatch = options.didMatch || (() => {})

    const { results, searchId } = await window.execAPI.ripgrepFileSearch({
      directoryPath,
      options: {
        followSymlinks: options.followSymlinks,
        includeHidden: options.includeHidden,
        noIgnore: options.noIgnore,
        inclusions: options.inclusions || []
      }
    })

    searchIds.push(searchId)

    for (const line of results) {
      options.didSearchPaths(++numPathsFound.num)
      didMatch(line)
    }
  }
}

export default FileSearcher
