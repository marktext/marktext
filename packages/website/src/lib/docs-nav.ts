export type DocTabId = 'user' | 'dev'

export type DocPage = {
  /** URL slug, joined with `/` becomes the final path under /docs/ */
  slug: string[]
  /** Page title as shown in the sidebar / breadcrumb / palette */
  title: string
  /** Markdown filename, relative to content/docs/ */
  file: string
  /** Optional short subtitle (used in the palette) */
  hint?: string
}

export type DocGroup = {
  label: string
  pages: DocPage[]
}

export type DocTab = {
  id: DocTabId
  label: string
  groups: DocGroup[]
}

export const DOC_TABS: DocTab[] = [
  {
    id: 'user',
    label: 'User docs',
    groups: [
      {
        label: 'Quick start',
        pages: [
          { slug: ['introduction'], title: 'Introduction', file: 'README.md', hint: 'Overview & getting started' },
          { slug: ['installation'], title: 'Installation', file: 'end-user/INSTALLATION.md', hint: 'Download & install on every platform' },
          { slug: ['linux'], title: 'Linux notes', file: 'end-user/LINUX.md', hint: 'Distro-specific install tips & quirks' },
          { slug: ['basics'], title: 'Basics', file: 'end-user/BASICS.md', hint: 'The interface, files & tabs' },
          { slug: ['editing'], title: 'Editing in depth', file: 'end-user/EDITING.md', hint: 'Shortcuts, format bar & find/replace' },
          { slug: ['spelling'], title: 'Spelling', file: 'end-user/SPELLING.md', hint: 'Spell checker & dictionaries' },
          { slug: ['markdown-syntax'], title: 'Markdown syntax', file: 'end-user/MARKDOWN_SYNTAX.md', hint: 'Every element MarkText renders' }
        ]
      },
      {
        label: 'Configuration',
        pages: [
          { slug: ['preferences'], title: 'Preferences', file: 'end-user/PREFERENCES.md', hint: 'App settings reference' },
          { slug: ['key-bindings'], title: 'Key bindings', file: 'end-user/KEYBINDINGS.md', hint: 'Default & custom shortcuts' },
          { slug: ['key-bindings-macos'], title: 'Key bindings (macOS)', file: 'end-user/KEYBINDINGS_OSX.md', hint: 'Default shortcuts on macOS' },
          { slug: ['key-bindings-linux'], title: 'Key bindings (Linux)', file: 'end-user/KEYBINDINGS_LINUX.md', hint: 'Default shortcuts on Linux' },
          { slug: ['key-bindings-windows'], title: 'Key bindings (Windows)', file: 'end-user/KEYBINDINGS_WINDOWS.md', hint: 'Default shortcuts on Windows' },
          { slug: ['application-data-directory'], title: 'Application data directory', file: 'end-user/APPLICATION_DATA_DIRECTORY.md', hint: 'Where MarkText stores user data' },
          { slug: ['environment-variables'], title: 'Environment variables', file: 'end-user/ENVIRONMENT.md', hint: 'Runtime environment overrides' },
          { slug: ['cli'], title: 'Command line interface', file: 'end-user/CLI.md', hint: 'Flags, switches, exit codes' }
        ]
      },
      {
        label: 'Export & themes',
        pages: [
          { slug: ['export'], title: 'Export a document', file: 'end-user/EXPORT.md', hint: 'PDF, HTML, image export' },
          { slug: ['themes'], title: 'Themes', file: 'end-user/THEMES.md', hint: 'Built-in & custom UI themes' },
          { slug: ['export-themes'], title: 'Themes for exporting', file: 'end-user/EXPORT_THEMES.md', hint: 'Style your exported HTML' },
          { slug: ['images'], title: 'Image support', file: 'end-user/IMAGES.md', hint: 'Copy images to a local folder' },
          { slug: ['image-uploader'], title: 'Image uploader configuration', file: 'end-user/IMAGE_UPLOADER_CONFIGRATION.md', hint: 'Cloud image hosts' }
        ]
      },
      {
        label: 'More',
        pages: [
          { slug: ['portable'], title: 'Portable mode', file: 'end-user/PORTABLE.md', hint: 'Run MarkText from a USB stick' },
          { slug: ['faq'], title: 'FAQ', file: 'end-user/FAQ.md', hint: 'Frequently asked questions' }
        ]
      }
    ]
  },
  {
    id: 'dev',
    label: 'Developer docs',
    groups: [
      {
        label: 'Get started',
        pages: [
          { slug: ['dev', 'overview'], title: 'Developer overview', file: 'dev/README.md', hint: 'Where to start contributing' },
          { slug: ['dev', 'build'], title: 'Build instructions', file: 'dev/BUILD.md', hint: 'Build MarkText from source' },
          { slug: ['dev', 'linux-dev'], title: 'Linux dev environment', file: 'dev/LINUX_DEV.md', hint: 'Distro-specific tooling notes' },
          { slug: ['dev', 'debugging'], title: 'Debugging', file: 'dev/DEBUGGING.md', hint: 'Attach to main / renderer' }
        ]
      },
      {
        label: 'Architecture & code',
        pages: [
          { slug: ['dev', 'architecture'], title: 'Architecture', file: 'dev/ARCHITECTURE.md', hint: 'Process model & module layering' },
          { slug: ['dev', 'interface'], title: 'Interface', file: 'dev/INTERFACE.md', hint: 'Muya & renderer public interfaces' },
          { slug: ['dev', 'ipc'], title: 'IPC', file: 'dev/IPC.md', hint: 'Typed mt:: channel catalog' },
          { slug: ['dev', 'typescript'], title: 'TypeScript', file: 'dev/TYPESCRIPT.md', hint: 'TS conventions & strict mode' },
          { slug: ['dev', 'performance'], title: 'Performance', file: 'dev/PERFORMANCE.md', hint: 'Measurement workflow' }
        ]
      },
      {
        label: 'Release',
        pages: [
          { slug: ['dev', 'release'], title: 'Release process', file: 'dev/RELEASE.md', hint: 'Cut a public release' },
          { slug: ['dev', 'hotfix'], title: 'Hotfix release', file: 'dev/RELEASE_HOTFIX.md', hint: 'Patch a published release' }
        ]
      },
      {
        label: 'Project',
        pages: [
          { slug: ['dev', 'code-of-conduct'], title: 'Code of conduct', file: 'dev/CODE_OF_CONDUCT.md', hint: 'Community guidelines' },
          { slug: ['changelog'], title: 'Changelog', file: 'CHANGELOG.md', hint: 'Release history' }
        ]
      }
    ]
  }
]

/** A flat ordered list of every page across both tabs (for the pager + sitemap). */
export type DocPageWithCtx = DocPage & {
  tab: DocTabId
  tabLabel: string
  group: string
  href: string
}

export const ALL_PAGES: DocPageWithCtx[] = DOC_TABS.flatMap((tab) =>
  tab.groups.flatMap((group) =>
    group.pages.map<DocPageWithCtx>((page) => ({
      ...page,
      tab: tab.id,
      tabLabel: tab.label,
      group: group.label,
      href: '/docs/' + page.slug.join('/')
    }))
  )
)

const PAGE_BY_KEY = new Map<string, { page: DocPageWithCtx; index: number }>(
  ALL_PAGES.map((page, index) => [page.slug.join('/'), { page, index }])
)

/** Resolve a slug array (from a [...slug] route) to a registry entry, or null. */
export function findPageBySlug(segments: string[]): DocPageWithCtx | null {
  return PAGE_BY_KEY.get(segments.join('/'))?.page ?? null
}

/** prev / next page in the flat ordered list. */
export function neighborsFor(slug: string[]): {
  prev: DocPageWithCtx | null
  next: DocPageWithCtx | null
} {
  const entry = PAGE_BY_KEY.get(slug.join('/'))
  if (!entry) return { prev: null, next: null }
  const { index } = entry
  return {
    prev: index > 0 ? ALL_PAGES[index - 1] : null,
    next: index < ALL_PAGES.length - 1 ? ALL_PAGES[index + 1] : null
  }
}

/** First page of a given tab — used for `/docs` redirect and tab switch fallback. */
export function firstPageOfTab(tab: DocTabId): DocPageWithCtx {
  const p = ALL_PAGES.find((page) => page.tab === tab)
  if (!p) throw new Error(`No pages registered for tab "${tab}"`)
  return p
}
