import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://marktext.me/',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1
    }
  ]
}
