import type { PlantumlFetchResult } from '@shared/types/ipc'

export const TIMEOUT_MS = 15_000
export const MAX_BYTES = 20 * 1024 * 1024

/** `net.fetch`, narrowed to what fetching a rendered diagram needs. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/**
 * Retrieve a rendered diagram. The URL must already have been composed by
 * `buildPlantumlUrl`: this function does not decide what may be reached, only
 * what may come back.
 */
export const fetchPlantumlImage = async(
  url: string,
  fetchImpl: FetchLike
): Promise<PlantumlFetchResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      // The URL was checked against the configured server; a redirect would
      // reach a host that check never saw — a render server could use one to
      // probe the loopback interface or an intranet the renderer cannot.
      redirect: 'error',
      // Rendering a diagram has no use for the session's cookies.
      credentials: 'omit'
    })
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }

    const mime = response.headers.get('content-type') ?? ''
    if (!mime.startsWith('image/')) return { ok: false, error: `Unexpected content type ${mime}` }

    const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (declared > MAX_BYTES) return { ok: false, error: 'Response too large' }

    const data = new Uint8Array(await response.arrayBuffer())
    if (data.byteLength > MAX_BYTES) return { ok: false, error: 'Response too large' }

    return { ok: true, mime, data }
  } finally {
    clearTimeout(timer)
  }
}
