import path from 'path'
import fs from 'fs'
import ignore, { type Ignore } from 'ignore'

/**
 * Loads and parses a .gitignore file at the root of a given directory.
 * Always returns an `ignore` instance — at minimum filtering `.git/`.
 * If a .gitignore exists, its patterns are included as well.
 */
export const loadGitignore = (rootPath: string): Ignore => {
  const resolvedRoot = path.resolve(rootPath)
  const ig = ignore()

  // Always ignore .git directory itself
  ig.add('.git')

  const gitignorePath = path.resolve(resolvedRoot, '.gitignore')

  // Guard against path traversal: ensure the resolved path stays within rootPath
  if (!gitignorePath.startsWith(resolvedRoot)) return ig

  try {
    const content = fs.readFileSync(gitignorePath, 'utf8')
    ig.add(content)
  } catch {
    // No .gitignore found — still filter .git
  }

  return ig
}

/**
 * Check whether a given absolute pathname should be ignored according to the
 * .gitignore rules. The path is made relative to rootPath before testing.
 */
export const isGitignored = (
  ig: Ignore,
  rootPath: string,
  pathname: string
): boolean => {
  const relativePath = path.relative(rootPath, pathname)
  if (!relativePath || relativePath.startsWith('..')) return false
  return ig.ignores(relativePath)
}
