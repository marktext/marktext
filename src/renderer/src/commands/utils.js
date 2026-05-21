/// Check whether the package is updatable at runtime.
export const isUpdatable = async() => {
  const resourcesPath =
    (window.electron && window.electron.process && window.electron.process.resourcesPath) ||
    (window.electron && window.electron.paths && window.electron.paths.resources) ||
    ''
  const env = (window.electron && window.electron.process && window.electron.process.env) || {}
  const platform = (window.electron && window.electron.process && window.electron.process.platform) || ''

  const resFile = await window.fileUtils.isFile(window.path.join(resourcesPath, 'app-update.yml'))
  if (!resFile) {
    return false
  } else if (env.APPIMAGE) {
    return true
  } else if (
    platform === 'win32' &&
    (await window.fileUtils.isFile(window.path.join(resourcesPath, 'md.ico')))
  ) {
    return true
  }
  return false
}
