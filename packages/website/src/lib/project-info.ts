import snapshot from './project-info.snapshot.json'
import { getReleaseDownloads } from './downloads'

export const PROJECT_INFO = snapshot
export const RELEASE_DOWNLOADS = getReleaseDownloads(
  snapshot.releaseVersion,
  snapshot.releaseAssets
)
