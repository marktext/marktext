import { ipcMain, net } from 'electron'

const TIMEOUT_MS = 1500
const MAX_BYTES = 1024 * 1024

type FetchLinkHtml = (url: string, init: RequestInit) => Promise<Response>

export const fetchLinkHtml = async(url: string, fetchImpl: FetchLinkHtml): Promise<string> => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ''
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return ''

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      credentials: 'omit'
    })
    if (
      response.status !== 200 ||
      !/^text\/html\b/i.test(response.headers.get('content-type') ?? '')
    ) {
      await response.body?.cancel()
      return ''
    }
    const reader = response.body?.getReader()
    if (!reader) return ''
    const decoder = new TextDecoder()
    let html = ''
    let size = 0
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return html + decoder.decode()
        size += value.byteLength
        if (size > MAX_BYTES) return ''
        html += decoder.decode(value, { stream: true })
      }
    } finally {
      // Stop oversized or interrupted responses instead of leaving them streaming.
      await reader.cancel().catch(() => {})
    }
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export const registerLinkHtmlHandler = (): void => {
  ipcMain.handle('mt::link::fetch-html', (_event, url: string) => fetchLinkHtml(url, net.fetch))
}
