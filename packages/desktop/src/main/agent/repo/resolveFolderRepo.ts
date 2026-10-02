import log from 'electron-log'
import { getRepoRoot, getUserName } from './gitService'
import type { RepoBinding } from './repoRegistry'

/** Git root of `dir`, or `{ kind: 'none' }` when it is not a work tree or git cannot answer. */
export const resolveFolderRepo = async(dir: string): Promise<RepoBinding> => {
  try {
    const root = await getRepoRoot(dir)
    if (!root) return { kind: 'none' }
    return { kind: 'repo', root, userName: await getUserName(root) }
  } catch (error) {
    // A missing or failing git must not block opening the folder.
    log.error('Failed to resolve git repository:', error)
    return { kind: 'none' }
  }
}
