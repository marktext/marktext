import { shell } from 'electron'
import { GITHUB_REPO_URL } from '../config'

export const createGitHubIssueUrl = (title, msg) => {
  const issueUrl = new URL(`${GITHUB_REPO_URL}/issues/new`)
  if (title) {
    issueUrl.searchParams.set('title', title)
  }
  if (msg) {
    issueUrl.searchParams.set('body', msg)
  }
  return issueUrl.toString()
}

export const createAndOpenGitHubIssueUrl = (title, msg) => {
  shell.openExternal(createGitHubIssueUrl(title, msg))
}
