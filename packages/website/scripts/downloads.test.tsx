import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import Download from '../src/components/Download'
import DownloadButton from '../src/components/DownloadButton'
import { detectDeviceTarget, getDeviceTarget, type BrowserDevice } from '../src/lib/device-target'
import { getReleaseDownloads } from '../src/lib/downloads'
import { PROJECT_INFO, RELEASE_DOWNLOADS } from '../src/lib/project-info'
import { getProjectInfo } from './fetch-project-info'

const mac: BrowserDevice = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 0
}

test('macOS leaves the chip unknown when the UA claims Intel', () => {
  assert.deepEqual(getDeviceTarget(mac), { platform: 'mac', architecture: null })
})

test('client hints distinguish Apple Silicon, Windows Arm, and 64-bit x86', async () => {
  for (const [platform, os] of [
    ['macOS', 'mac'],
    ['Windows', 'windows'],
    ['Linux', 'linux']
  ]) {
    for (const [architecture, expected] of [
      ['arm', 'arm64'],
      ['x86', 'x64']
    ]) {
      const browser = {
        ...mac,
        userAgentData: {
          platform,
          getHighEntropyValues: async () => ({ architecture, bitness: '64' })
        }
      }
      assert.deepEqual(await detectDeviceTarget(browser), { platform: os, architecture: expected })
    }
  }
})

test('frozen Chromium CPU tokens never override missing or denied hints', async () => {
  const browser = {
    ...mac,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/142.0.0.0',
    platform: 'Win32',
    userAgentData: {
      platform: 'Windows',
      getHighEntropyValues: async () => {
        throw new Error('Not allowed')
      }
    }
  }
  assert.deepEqual(await detectDeviceTarget(browser), { platform: 'windows', architecture: null })
  const omittedHints = {
    ...browser,
    userAgentData: { platform: 'Windows', getHighEntropyValues: async () => ({}) }
  }
  assert.deepEqual(await detectDeviceTarget(omittedHints), {
    platform: 'windows',
    architecture: null
  })
})

test('32-bit and unrecognized client hints cannot select a 64-bit build', async () => {
  for (const hints of [
    { architecture: 'x86', bitness: '32' },
    { architecture: 'other', bitness: '64' }
  ]) {
    assert.deepEqual(
      await detectDeviceTarget({
        ...mac,
        userAgentData: { platform: 'macOS', getHighEntropyValues: async () => hints }
      }),
      { platform: 'mac', architecture: null }
    )
  }
})

test('unfrozen desktop UAs can identify Linux and Windows CPUs', () => {
  for (const [platform, userAgent, os, architecture] of [
    ['Linux aarch64', 'Mozilla/5.0 (X11; Linux aarch64) Firefox/144.0', 'linux', 'arm64'],
    ['Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/144.0', 'linux', 'x64'],
    ['Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/144.0', 'windows', 'x64']
  ]) {
    assert.deepEqual(getDeviceTarget({ ...mac, platform, userAgent }), {
      platform: os,
      architecture
    })
  }
})

test('phones, desktop-mode iPads, ChromeOS, and unknown systems offer all platforms', () => {
  for (const browser of [
    { ...mac, maxTouchPoints: 5 },
    { ...mac, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' },
    { ...mac, platform: 'Linux armv8l', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/142.0' },
    { ...mac, platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; CrOS x86_64)' },
    { ...mac, platform: 'Unknown', userAgent: 'Unknown' }
  ]) {
    assert.deepEqual(getDeviceTarget(browser), { platform: null, architecture: null })
  }
})

test('download URLs include only published installers from the displayed version', () => {
  const installers = PROJECT_INFO.releaseAssets.filter((name) =>
    /\.(dmg|exe|zip|AppImage|deb|rpm|tar\.gz|snap)$/.test(name)
  )
  assert.equal(RELEASE_DOWNLOADS.length, installers.length)
  for (const item of RELEASE_DOWNLOADS) {
    const url = new URL(item.url)
    assert.equal(url.origin, 'https://github.com')
    assert.ok(
      url.pathname.startsWith(
        `/marktext/marktext/releases/download/${PROJECT_INFO.releaseVersion}/`
      )
    )
    assert.ok(
      PROJECT_INFO.releaseAssets.includes(decodeURIComponent(url.pathname.split('/').at(-1)!))
    )
  }
  const x64Only = getReleaseDownloads('v1.0.0', ['marktext-linux-1.0.0.snap'])
  assert.equal(x64Only.length, 1)
  assert.equal(x64Only[0].architecture, 'x64')
  assert.deepEqual(
    getReleaseDownloads('v1.0.0', ['marktext-mac-arm64-0.23.0.dmg', 'latest.yml']),
    []
  )
  assert.deepEqual(getReleaseDownloads('v1.0.0', ['marktext-mac-arm64-1.0.0.dmg.blockmap']), [])
})

test('initial HTML offers all direct downloads and an honest generic hero button', () => {
  const html = renderToStaticMarkup(
    <>
      <DownloadButton />
      <Download />
    </>
  )
  assert.ok(html.includes('Download MarkText'))
  assert.ok(html.includes('href="#download"'))
  assert.ok(html.includes('Apple Silicon'))
  assert.ok(html.includes('Arm64'))
  assert.ok(html.includes('Not available'))
  for (const item of RELEASE_DOWNLOADS) assert.ok(html.includes(`href="${item.url}"`))
})

test('a release without usable installers keeps the version and asset snapshot together', async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes('/releases/latest'))
      return Response.json({ tag_name: 'v1.0.0', assets: [{ name: 'latest.yml' }] })
    if (url.includes('/contributors')) return Response.json([])
    return Response.json({ stargazers_count: 70000 })
  }
  assert.deepEqual(await getProjectInfo(new AbortController().signal, fetcher), {
    releaseVersion: undefined,
    releaseAssets: undefined,
    githubStars: 70000,
    contributors: 0
  })
})
