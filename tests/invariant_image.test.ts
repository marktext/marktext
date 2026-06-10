import { getImageInfo } from '../packages/muya/src/utils/image';

describe('Image utility must not allow requests to internal/metadata endpoints', () => {
  const adversarialPayloads = [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:3000/admin/secret',
    'file:///etc/passwd',
    'http://[::1]/internal',
  ];

  const validPayload = 'https://example.com/image.png';

  // Mock fetch to detect what URLs are actually requested
  let requestedUrls: string[] = [];
  const originalFetch = global.fetch;

  beforeEach(() => {
    requestedUrls = [];
    global.fetch = jest.fn(async (url: any) => {
      requestedUrls.push(typeof url === 'string' ? url : url.toString());
      return new Response(null, { status: 200, headers: { 'content-type': 'image/png' } });
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test.each(adversarialPayloads)(
    'rejects or blocks internal/dangerous URL: %s',
    async (payload) => {
      const result = await getImageInfo(payload);
      // Security invariant: internal network URLs must either be rejected
      // (not fetched) or return an error/empty result
      const wasFetched = requestedUrls.includes(payload);
      if (wasFetched) {
        // If the URL was fetched without validation, the security property is violated
        expect(wasFetched).toBe(false);
      }
    }
  );

  test('allows valid external HTTPS image URL', async () => {
    const result = await getImageInfo(validPayload);
    // Valid URLs should be processed (fetched)
    expect(requestedUrls).toContain(validPayload);
  });
});