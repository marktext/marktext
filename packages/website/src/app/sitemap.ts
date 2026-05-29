import type { MetadataRoute } from 'next'
import { ALL_PAGES } from '@/lib/docs-nav'

const SITE = 'https://marktext.me'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: SITE + '/',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1
    },
    {
      url: SITE + '/docs',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9
    },
    ...ALL_PAGES.map((page) => ({
      url: SITE + page.href,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7
    }))
  ]
}
