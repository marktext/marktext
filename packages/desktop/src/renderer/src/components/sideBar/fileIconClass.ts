import fileIcons from '@marktext/file-icons'

const getClassByName = (name: string): string | null => {
  const icon = fileIcons.matchName(name)
  return icon ? icon.getClass(0, false) : null
}

/**
 * Resolve the icon CSS classes for a file name shown in the side bar tree.
 *
 * file-icons tests whole-name rules before extension rules, so a markdown
 * file whose name resembles another tool's (`Dockerfile-Notes.md`) picks up
 * that tool's icon (#4890). The tree only lists files with markdown
 * extensions (see main/filesystem/watcher.ts), so the extension is the
 * reliable signal — match on it first and use the full name only as a
 * fallback for extensionless names.
 */
export const getFileIconClasses = (fileName: string): string[] => {
  const name = fileName || 'mock.md'
  const dotIndex = name.lastIndexOf('.')
  const classNames =
    (dotIndex !== -1 ? getClassByName(`mock${name.slice(dotIndex)}`) : null) ??
    getClassByName(name) ??
    // Use fallback icon when the icon is unknown.
    getClassByName('mock.md')
  return (classNames ?? '').split(/\s/)
}
