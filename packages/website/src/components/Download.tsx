'use client'

import Link from 'next/link'
import { useDeviceTarget } from '@/hooks/useDeviceTarget'
import { DOWNLOAD, DOWNLOAD_PLATFORMS, architectureLabel } from '@/lib/downloads'
import { PROJECT_INFO, RELEASE_DOWNLOADS } from '@/lib/project-info'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS } from '@/lib/sections'
import { DownloadIcon, LinuxIcon, MacIcon, WindowsIcon } from './Icons'

const PLATFORM_ICONS = { mac: MacIcon, windows: WindowsIcon, linux: LinuxIcon }
const PRIMARY_LABELS = { mac: 'DMG installer', windows: 'Windows installer', linux: 'AppImage' }
const FORMAT_LABELS = { zip: '.zip', deb: '.deb', rpm: '.rpm', 'tar.gz': '.tar.gz', snap: '.snap' }
const FORMAT_DESCRIPTIONS = { deb: 'Debian, Ubuntu', rpm: 'Red Hat, Fedora' }

export default function Download() {
  const target = useDeviceTarget()

  return (
    <section
      className="block download-section"
      id={SECTIONS.download}
      aria-labelledby="download-title"
    >
      <div className="wrap">
        <div className="download-heading reveal">
          <span className="kicker kicker--center">Made for your desktop</span>
          <h2 id="download-title">
            Download <span className="grad-text">MarkText</span>
          </h2>
          <p>Free and open source. Your Markdown editor, on macOS, Windows, and Linux.</p>
          <div className="download-version">
            <span className="tag">{PROJECT_INFO.releaseVersion}</span>
            <span>Latest stable release</span>
          </div>
        </div>

        <div className="download-grid">
          {DOWNLOAD_PLATFORMS.map((platform) => {
            const Icon = PLATFORM_ICONS[platform.id]
            const downloads = RELEASE_DOWNLOADS.filter((item) => item.platform === platform.id)
            const primary = downloads.filter((item) => item.format === platform.formats[0])
            const otherFormats = platform.formats
              .slice(1)
              .filter((format) => downloads.some((item) => item.format === format))
            const current = target.platform === platform.id
            return (
              <article
                className={`download-card${current ? ' download-card--current' : ''}`}
                id={`download-${platform.id}`}
                key={platform.id}
                aria-labelledby={`download-${platform.id}-title`}
              >
                <div className="download-card-top">
                  <Icon aria-hidden="true" />
                  {current && <span className="download-os-badge">Your OS</span>}
                </div>
                <h3 id={`download-${platform.id}-title`}>{platform.label}</h3>
                <p className="download-description">{platform.description}</p>
                <div className="download-primary">
                  <span className="download-format-label">{PRIMARY_LABELS[platform.id]}</span>
                  <div className="download-choices">
                    {primary.map((item) => {
                      const recommended = current && target.architecture === item.architecture
                      return (
                        <a
                          className={`download-choice${recommended ? ' download-choice--recommended' : ''}`}
                          href={item.url}
                          key={item.architecture}
                          aria-label={`Download MarkText for ${platform.label}, ${architectureLabel(platform.id, item.architecture)}, ${item.format}${recommended ? ', recommended for your device' : ''}`}
                        >
                          <DownloadIcon aria-hidden="true" />
                          {architectureLabel(platform.id, item.architecture)}
                        </a>
                      )
                    })}
                  </div>
                  {!primary.length && (
                    <a href={DOWNLOAD.releases} {...EXT_LINK}>
                      View available releases
                    </a>
                  )}
                </div>
                <div className="download-other">
                  <h4>Other downloads</h4>
                  <table>
                    <caption className="sr-only">Other downloads for {platform.label}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Format</th>
                        {platform.architectures.map((architecture) => (
                          <th scope="col" key={architecture}>
                            {architectureLabel(platform.id, architecture)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otherFormats.map((format) => (
                        <tr key={format}>
                          <th scope="row">
                            {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] || `.${format}`}
                            {format in FORMAT_DESCRIPTIONS && (
                              <small>
                                {FORMAT_DESCRIPTIONS[format as keyof typeof FORMAT_DESCRIPTIONS]}
                              </small>
                            )}
                          </th>
                          {platform.architectures.map((architecture) => {
                            const download = downloads.find(
                              (item) => item.format === format && item.architecture === architecture
                            )
                            return (
                              <td key={architecture}>
                                {download ? (
                                  <a
                                    href={download.url}
                                    aria-label={`Download ${format} for ${platform.label}, ${architectureLabel(platform.id, architecture)}`}
                                  >
                                    {architectureLabel(platform.id, architecture)}
                                  </a>
                                ) : (
                                  <span aria-label="Not available">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {platform.id === 'mac' && (
                  <p className="download-homebrew">
                    Or install with Homebrew:
                    <br />
                    <code className="inline">brew install --cask mark-text</code>
                  </p>
                )}
              </article>
            )
          })}
        </div>

        <div className="download-help reveal">
          <details>
            <summary>Not sure which chip you have?</summary>
            <div>
              <p>
                <strong>macOS:</strong> Open the Apple menu → About This Mac. Choose Apple Silicon
                for an Apple M-series chip, or Intel for an Intel processor.
              </p>
              <p>
                <strong>Windows:</strong> Open Settings → System → About → System type. Choose Arm64
                for an ARM-based processor, or x64 for an Intel or AMD processor.
              </p>
              <p>
                <strong>Linux:</strong> Run <code>uname -m</code>. Choose x64 for{' '}
                <code>x86_64</code>, or Arm64 for <code>aarch64</code>.
              </p>
            </div>
          </details>
          <div className="download-footer-links">
            <Link href="/docs/installation">Installation guide</Link>
            <a href={`${DOWNLOAD.releases}/tag/${PROJECT_INFO.releaseVersion}`} {...EXT_LINK}>
              Release notes
            </a>
            <a href={DOWNLOAD.releases} {...EXT_LINK}>
              All releases
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
