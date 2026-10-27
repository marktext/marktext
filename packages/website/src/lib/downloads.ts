export const DOWNLOAD = {
  releases: 'https://github.com/marktext/marktext/releases',
  repo: 'https://github.com/marktext/marktext',
  contributing: 'https://github.com/marktext/marktext/blob/develop/.github/CONTRIBUTING.md',
  issues: 'https://github.com/marktext/marktext/issues',
  sponsor: 'https://github.com/sponsors/marktext',
  twitter:
    'https://twitter.com/intent/tweet?via=marktextme&url=https://github.com/marktext/marktext/&text=What%20do%20you%20want%20to%20say%20to%20app?&hashtags=happyMarkText',
  serpapi: 'https://serpapi.com/?utm_source=marktext'
}

export type Platform = 'mac' | 'windows' | 'linux'
export type Architecture = 'x64' | 'arm64'
export type DownloadFormat = 'dmg' | 'exe' | 'zip' | 'AppImage' | 'deb' | 'rpm' | 'tar.gz' | 'snap'
export type ReleaseDownload = {
  platform: Platform
  architecture: Architecture
  format: DownloadFormat
  url: string
}

export const DOWNLOAD_PLATFORMS: {
  id: Platform
  label: string
  description: string
  architectures: Architecture[]
  formats: DownloadFormat[]
}[] = [
  {
    id: 'mac',
    label: 'macOS',
    description: 'Apple Silicon and Intel Macs',
    architectures: ['arm64', 'x64'],
    formats: ['dmg', 'zip']
  },
  {
    id: 'windows',
    label: 'Windows',
    description: 'Intel, AMD, and Arm PCs',
    architectures: ['x64', 'arm64'],
    formats: ['exe', 'zip']
  },
  {
    id: 'linux',
    label: 'Linux',
    description: 'Debian, Ubuntu, Fedora, and more',
    architectures: ['x64', 'arm64'],
    formats: ['AppImage', 'deb', 'rpm', 'tar.gz', 'snap']
  }
]

export function architectureLabel(platform: Platform, architecture: Architecture): string {
  if (platform === 'mac') return architecture === 'arm64' ? 'Apple Silicon' : 'Intel'
  return architecture === 'arm64' ? 'Arm64' : 'x64'
}

// Only published assets are exposed; versioned URLs keep an older site build usable after a release.
export function getReleaseDownloads(tag: string, assetNames: string[]): ReleaseDownload[] {
  const version = tag.replace(/^v/, '')
  const names = new Set(assetNames)
  const downloads: ReleaseDownload[] = []
  for (const platform of DOWNLOAD_PLATFORMS) {
    for (const architecture of platform.architectures) {
      for (const format of platform.formats) {
        const prefix = platform.id === 'windows' ? 'win' : platform.id
        const arch = platform.id === 'linux' && architecture === 'x64' ? '' : `-${architecture}`
        const suffix = format === 'exe' ? '-setup.exe' : `.${format}`
        const name = `marktext-${prefix}${arch}-${version}${suffix}`
        if (names.has(name)) {
          downloads.push({
            platform: platform.id,
            architecture,
            format,
            url: `${DOWNLOAD.releases}/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`
          })
        }
      }
    }
  }
  return downloads
}
