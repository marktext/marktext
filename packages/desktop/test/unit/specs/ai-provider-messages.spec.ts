import { describe, expect, it } from 'vitest'
import { serializeProviderMessages } from 'main_renderer/ai/providerMessages'

describe('AI provider image message serialization', () => {
  const messages = [
    {
      role: 'user' as const,
      content: 'Read this screenshot.',
      images: [{ mimeType: 'image/png', data: 'aGVsbG8=' }]
    }
  ]

  it('keeps the existing plain-text wire shape', () => {
    expect(serializeProviderMessages('openai-chat-completions', [{ role: 'user', content: 'Hello' }])).toEqual([
      { role: 'user', content: 'Hello' }
    ])
    expect(serializeProviderMessages('anthropic-messages', [{ role: 'assistant', content: 'Hi' }])).toEqual([
      { role: 'assistant', content: 'Hi' }
    ])
  })

  it('serializes OpenAI-compatible images before text', () => {
    expect(serializeProviderMessages('openai-chat-completions', messages)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=', detail: 'auto' } },
          { type: 'text', text: 'Read this screenshot.' }
        ]
      }
    ])
  })

  it('serializes Anthropic base64 images before text', () => {
    expect(serializeProviderMessages('anthropic-messages', messages)).toEqual([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: 'aGVsbG8=' }
          },
          { type: 'text', text: 'Read this screenshot.' }
        ]
      }
    ])
  })
})
