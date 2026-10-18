const APP_NAME = 'MarkText'

// Linux/Windows window managers, taskbars and task switchers identify the
// application from the trailing "- AppName" of the title. macOS already shows
// the app name in the menu bar and Dock, so its title stays document-only.
export function buildWindowTitle(
  filename: string | undefined,
  projectName: string,
  isOsx: boolean
): string {
  let title: string
  if (filename) {
    title = projectName ? `${filename} - ${projectName}` : filename
  } else {
    title = projectName
  }

  if (isOsx) return title
  return title ? `${title} - ${APP_NAME}` : APP_NAME
}
