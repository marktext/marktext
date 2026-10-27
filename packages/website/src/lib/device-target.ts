import type { Architecture, Platform } from './downloads'

export type DeviceTarget = { platform: Platform | null; architecture: Architecture | null }
export type BrowserDevice = Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> & {
  userAgentData?: {
    platform?: string
    mobile?: boolean
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>
  }
}

export function getDeviceTarget(browser: BrowserDevice): DeviceTarget {
  const { userAgent, platform, maxTouchPoints, userAgentData } = browser
  const unknown = { platform: null, architecture: null }
  if (
    userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
    return unknown

  const system = userAgentData?.platform || platform || userAgent
  const os = /Mac/i.test(system)
    ? 'mac'
    : /Win/i.test(system)
      ? 'windows'
      : /Linux/i.test(system) && !/CrOS/i.test(userAgent)
        ? 'linux'
        : null
  if (!os) return unknown

  // macOS UAs can claim Intel even on Apple Silicon; Chromium also freezes desktop CPU tokens.
  const frozen = /Chrome|Chromium|Edg\//i.test(userAgent)
  const architecture =
    os === 'mac' || frozen
      ? null
      : /aarch64|arm64/i.test(`${platform} ${userAgent}`)
        ? 'arm64'
        : /x86_64|Win64|WOW64|amd64|x64/i.test(`${platform} ${userAgent}`)
          ? 'x64'
          : null
  return { platform: os, architecture }
}

export async function detectDeviceTarget(browser: BrowserDevice): Promise<DeviceTarget> {
  const target = getDeviceTarget(browser)
  if (!target.platform || !browser.userAgentData?.getHighEntropyValues) return target
  try {
    const hints = await browser.userAgentData.getHighEntropyValues(['architecture', 'bitness'])
    const architecture =
      hints.bitness === '64'
        ? hints.architecture === 'arm'
          ? 'arm64'
          : hints.architecture === 'x86'
            ? 'x64'
            : null
        : null
    return { ...target, architecture }
  } catch {
    return target
  }
}
