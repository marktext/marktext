import { describe, it, expect, vi } from 'vitest'
import { fetchPlantumlImage, MAX_BYTES, type FetchLike } from 'main_renderer/ipc/plantumlFetch'

const URL = 'https://www.plantuml.com/plantuml/svg/AAAA'

const respond = (
  body: BodyInit | null,
  headers: Record<string, string>,
  init: ResponseInit = {}
): Response => new Response(body, { status: 200, headers, ...init })

describe('fetchPlantumlImage', () => {
  it('returns the bytes and the content type', async() => {
    const fetchImpl = vi.fn(async() =>
      respond(new Uint8Array([1, 2, 3]), { 'content-type': 'image/svg+xml' })
    )

    const result = await fetchPlantumlImage(URL, fetchImpl)

    expect(result).toEqual({ ok: true, mime: 'image/svg+xml', data: new Uint8Array([1, 2, 3]) })
  })

  it('refuses to follow a redirect and sends no credentials', async() => {
    const fetchImpl = vi.fn<FetchLike>(async() =>
      respond(null, { 'content-type': 'image/png' })
    )

    await fetchPlantumlImage(URL, fetchImpl)

    const [, init] = fetchImpl.mock.calls[0]
    expect(init.redirect).toBe('error')
    expect(init.credentials).toBe('omit')
  })

  it('reports a failed status rather than its body', async() => {
    const fetchImpl = vi.fn(async() =>
      respond('<html>not found</html>', { 'content-type': 'text/html' }, { status: 404 })
    )

    expect(await fetchPlantumlImage(URL, fetchImpl)).toEqual({ ok: false, error: 'HTTP 404' })
  })

  it('refuses anything that is not an image', async() => {
    const fetchImpl = vi.fn(async() => respond('rm -rf /', { 'content-type': 'text/x-sh' }))

    const result = await fetchPlantumlImage(URL, fetchImpl)

    expect(result.ok).toBe(false)
  })

  it('refuses a response that declares itself too large', async() => {
    const fetchImpl = vi.fn(async() =>
      respond('x', {
        'content-type': 'image/png',
        'content-length': String(MAX_BYTES + 1)
      })
    )

    expect(await fetchPlantumlImage(URL, fetchImpl)).toEqual({
      ok: false,
      error: 'Response too large'
    })
  })
})
