import { describe, expect, it, vi } from 'vitest'
import { fetchLinkHtml, registerLinkHtmlHandler } from 'main_renderer/ipc/linkHtml'

const { handle, fetchImpl } = vi.hoisted(() => ({ handle: vi.fn(), fetchImpl: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle }, net: { fetch: fetchImpl } }))

const htmlResponse = (body: string, init: ResponseInit = {}) =>
  new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' }, ...init })

describe('link HTML transport', () => {
  it('returns HTML through a registered IPC handler without sending session cookies', async() => {
    registerLinkHtmlHandler()
    const handler = handle.mock.calls.find(([channel]) => channel === 'mt::link::fetch-html')?.[1]
    fetchImpl.mockResolvedValueOnce(htmlResponse('<title>Example &amp; title</title>'))
    expect(await handler({}, 'https://example.com')).toBe('<title>Example &amp; title</title>')
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com', {
      signal: expect.any(AbortSignal), credentials: 'omit'
    })
  })

  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,test', 'invalid'])('rejects %s', async(url) => {
    const fetcher = vi.fn()
    expect(await fetchLinkHtml(url, fetcher)).toBe('')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it.each([
    new Response('missing', { status: 404 }),
    new Response('{}', { headers: { 'content-type': 'application/json' } })
  ])('ignores unsuccessful or non-HTML responses', async(response) => {
    expect(await fetchLinkHtml('https://example.com', async() => response)).toBe('')
  })

  it('stops reading oversized responses', async() => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)) },
      cancel
    })
    const response = new Response(body, { headers: { 'content-type': 'text/html' } })
    expect(await fetchLinkHtml('https://example.com', async() => response)).toBe('')
    expect(cancel).toHaveBeenCalled()
  })

  it('falls back on a network failure', async() => {
    expect(await fetchLinkHtml('https://example.com', async() => { throw new Error('offline') })).toBe('')
  })

  it('aborts a slow network request', async() => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | null | undefined
      const result = fetchLinkHtml('https://example.com', async(_url, init) => {
        signal = init.signal
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
      })
      await vi.advanceTimersByTimeAsync(1500)
      expect(await result).toBe('')
      expect(signal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
