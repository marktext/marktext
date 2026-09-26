import type { PlantumlFetchResult } from '@shared/types/ipc'

export const TIMEOUT_MS = 15_000
export const MAX_BYTES = 20 * 1024 * 1024

/** `net.fetch`, narrowed to what fetching a rendered diagram needs. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** The body, or `null` once it has gone past the cap — at which point it stops being read. */
const readCapped = async(body: ReadableStream<Uint8Array> | null): Promise<Uint8Array | null> => {
  if (!body) return new Uint8Array()

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      total += value.byteLength
      if (total > MAX_BYTES) return null

      chunks.push(value)
    }
  } finally {
    // After `done` this is a no-op; on the way out early it closes the socket
    // instead of leaving the server streaming into a reader nobody reads.
    await reader.cancel().catch(() => {})
  }

  const data = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    data.set(chunk, at)
    at += chunk.byteLength
  }

  return data
}

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

    // Only a courtesy: a chunked response declares no length at all, which is
    // why the body is counted as it arrives rather than after.
    const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10)
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return { ok: false, error: 'Response too large' }
    }

    const data = await readCapped(response.body)
    if (!data) return { ok: false, error: 'Response too large' }

    return { ok: true, mime, data }
  } finally {
    clearTimeout(timer)
  }
}
