/// Check whether the package is updatable at runtime.
export const isUpdatable = () => {
  const resFile = window.fileUtils.isFile(window.path.join(window.nodeAPI.resourcesPath, 'app-update.yml'))
  if (!resFile) {
    return false
  } else if (window.nodeAPI.env.APPIMAGE) {
    return true
  } else if (
    window.nodeAPI.platform === 'win32' &&
    window.fileUtils.isFile(window.path.join(window.nodeAPI.resourcesPath, 'md.ico'))
  ) {
    return true
  }

  return false
}
