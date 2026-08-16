import type { AiProtocol } from '@shared/types/ai'

export interface ProviderImage {
  mimeType: string
  data: string
}

export interface ProviderMessage {
  role: 'user' | 'assistant'
  content: string
  images?: ProviderImage[]
}

export interface ProviderToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ProviderToolCall {
  name: string
  input: unknown
}

export const preciseEditTool: ProviderToolDefinition = {
  name: 'submit_markdown_edits',
  description: 'Submit validated Markdown edit operations. SEARCH strings must be copied exactly from the current document.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['changed', 'no_changes'] },
      summary: { type: 'string' },
      edits: {
        type: 'array',
        maxItems: 32,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            search: { type: 'string' },
            replace: { type: 'string' }
          },
          required: ['search', 'replace']
        }
      }
    },
    required: ['status', 'summary', 'edits']
  }
}

const toImageDataUrl = (image: ProviderImage): string => `data:${image.mimeType};base64,${image.data}`

export const serializeProviderMessages = (
  protocol: AiProtocol,
  messages: ProviderMessage[]
): Array<Record<string, unknown>> => messages.map(message => {
  if (!message.images?.length) return { role: message.role, content: message.content }
  if (protocol === 'anthropic-messages') {
    return {
      role: message.role,
      content: [
        ...message.images.map(image => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: image.mimeType,
            data: image.data
          }
        })),
        { type: 'text', text: message.content }
      ]
    }
  }
  return {
    role: message.role,
    content: [
      ...message.images.map(image => ({
        type: 'image_url',
        image_url: { url: toImageDataUrl(image), detail: 'auto' }
      })),
      { type: 'text', text: message.content }
    ]
  }
})
