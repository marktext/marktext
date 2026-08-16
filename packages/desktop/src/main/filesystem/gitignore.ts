import path from 'path'
import fs from 'fs'
import ignore, { type Ignore } from 'ignore'

/**
 * Loads and parses a .gitignore file at the root of a given directory.
 * Returns an `ignore` instance that can test whether a relative path is ignored.
 * Returns `null` if no .gitignore exists.
 */
export const loadGitignore = (rootPath: string): Ignore | null => {
  const resolvedRoot = path.resolve(rootPath)
  const gitignorePath = path.resolve(resolvedRoot, '.gitignore')

  // Guard against path traversal: ensure the resolved path stays within rootPath
  if (!gitignorePath.startsWith(resolvedRoot)) return null

  try {
    const content = fs.readFileSync(gitignorePath, 'utf8')
    const ig = ignore()
    ig.add(content)
    // Always ignore .git directory itself
    ig.add('.git')
    return ig
  } catch {
    return null
  }
}

/**
 * Check whether a given absolute pathname should be ignored according to the
 * .gitignore rules. The path is made relative to rootPath before testing.
 */
export const isGitignored = (
  ig: Ignore | null,
  rootPath: string,
  pathname: string
): boolean => {
  if (!ig) return false
  const relativePath = path.relative(rootPath, pathname)
  if (!relativePath || relativePath.startsWith('..')) return false
  return ig.ignores(relativePath)
}
