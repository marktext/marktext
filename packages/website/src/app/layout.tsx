import type { Metadata, Viewport } from 'next'
import 'katex/dist/katex.min.css'
import '../app.global.css'
import '../themes/default.css'
import '../components/TitleBar.css'
import '../components/Feature.css'
import '../components/Theme.css'
import '../components/Sponsor.css'
import '../components/Footer.css'

const SITE_URL = 'https://marktext.me'
const TITLE = 'MarkText — Simple and Elegant Markdown Editor'
const DESCRIPTION =
  'MarkText is a free, open-source, real-time preview markdown editor for macOS, Windows and Linux. Supports CommonMark, GitHub Flavored Markdown, math (KaTeX), Mermaid diagrams and PlantUML.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s | MarkText'
  },
  description: DESCRIPTION,
  applicationName: 'MarkText',
  keywords: [
    'markdown editor',
    'WYSIWYG markdown',
    'CommonMark',
    'GitHub Flavored Markdown',
    'GFM',
    'KaTeX',
    'Mermaid',
    'PlantUML',
    'Electron',
    'macOS',
    'Windows',
    'Linux'
  ],
  authors: [{ name: 'Ran Luo', url: 'https://github.com/Jocs' }],
  creator: 'Ran Luo',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.png' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: 'MarkText',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: '/favicon.png', width: 512, height: 512, alt: 'MarkText logo' }]
  },
  twitter: {
    card: 'summary_large_image',
    site: '@marktextapp',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/favicon.png']
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#21b56f'
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'MarkText',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'macOS, Windows, Linux',
  description: DESCRIPTION,
  url: SITE_URL,
  license: 'https://github.com/marktext/marktext/blob/develop/LICENSE',
  author: { '@type': 'Person', name: 'Ran Luo', url: 'https://github.com/Jocs' },
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: 'https://github.com/marktext/marktext/releases/latest',
  softwareVersion: 'latest'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div id="app">{children}</div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}
