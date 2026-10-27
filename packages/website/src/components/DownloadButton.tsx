'use client'

import { useDeviceTarget } from '@/hooks/useDeviceTarget'
import { DOWNLOAD_PLATFORMS } from '@/lib/downloads'
import { RELEASE_DOWNLOADS } from '@/lib/project-info'
import { SECTIONS, hash } from '@/lib/sections'
import { DownloadIcon } from './Icons'

export default function DownloadButton() {
  const target = useDeviceTarget()
  const platform = DOWNLOAD_PLATFORMS.find((item) => item.id === target.platform)
  const download = RELEASE_DOWNLOADS.find(
    (item) =>
      item.platform === target.platform &&
      item.architecture === target.architecture &&
      item.format === platform?.formats[0]
  )
  const href = download?.url || (platform ? `#download-${platform.id}` : hash(SECTIONS.download))

  return (
    <a className="btn btn-primary btn-lg hero-download" href={href}>
      <DownloadIcon aria-hidden="true" />
      {platform ? `Download for ${platform.label}` : 'Download MarkText'}
    </a>
  )
}
