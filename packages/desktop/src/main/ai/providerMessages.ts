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
