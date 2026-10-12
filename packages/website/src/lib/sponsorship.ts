import { DOWNLOAD } from './downloads'

export const CORPORATE_EMAIL = 'ransixi@gmail.com'
export const CORPORATE_CONTACT = `mailto:${CORPORATE_EMAIL}?subject=MarkText%20Corporate%20Sponsorship`

export const individualTiers = [
  {
    name: 'Supporter',
    icon: '❤️',
    price: 3,
    description:
      'Help keep MarkText free and open source by supporting bug fixes and ongoing maintenance.',
    action: 'Become a Supporter'
  },
  {
    name: 'Late Night Debugging',
    icon: '🍜',
    price: 5,
    description: 'Help fund bug fixes, dependency updates, and late-night releases.',
    action: 'Become a Backer'
  }
] as const

export const corporateTiers = [
  {
    id: 'community',
    name: 'Community Sponsor',
    icon: '🌱',
    price: 100,
    readme: false,
    releases: false,
    description:
      'Your company logo and link featured on the MarkText website while your sponsorship is active.',
    action: 'Become a Sponsor'
  },
  {
    id: 'gold',
    name: 'Gold Sponsor',
    icon: '🥇',
    price: 200,
    readme: true,
    releases: false,
    description:
      'Your company logo and link featured on the MarkText website and GitHub README while your sponsorship is active.',
    action: 'Become a Gold Sponsor'
  },
  {
    id: 'platinum',
    name: 'Platinum Sponsor',
    icon: '💎',
    price: 300,
    readme: true,
    releases: true,
    description:
      'Your company logo and link featured on the MarkText website, GitHub README, and new release notes published during your sponsorship.',
    action: 'Become a Platinum Sponsor'
  }
] as const

type Sponsor = {
  name: string
  logo?: { src: string; width: number; height: number; preserveColors?: boolean }
  url: string
  tier: 'early' | 'community' | 'gold' | 'platinum'
  placements: ('home' | 'sponsors')[]
  order: number
  active: boolean
  permanent: boolean
}

// SerpApi's one-time agreement guarantees permanent display, independent of monthly sponsorship status.
export const sponsors: Sponsor[] = [
  {
    name: 'SerpApi',
    logo: { src: '/assets/serpapi.png', width: 1765, height: 440 },
    url: DOWNLOAD.serpapi,
    tier: 'early',
    placements: ['home', 'sponsors'],
    order: 0,
    active: false,
    permanent: true
  }
]

export const fundingUses = [
  {
    title: 'Bug Fixes & Improvements',
    icon: 'bug',
    description: 'Fix bugs, improve performance, and maintain compatibility across platforms.'
  },
  {
    title: 'Releases & Maintenance',
    icon: 'release',
    description: 'Keep dependencies up to date and deliver new releases.'
  },
  {
    title: 'Community Contributions',
    icon: 'community',
    description: 'Review pull requests, maintain documentation, and support contributors.'
  },
  {
    title: 'Infrastructure',
    icon: 'server',
    description: 'Cover essential costs, including domain registration and website hosting.'
  }
] as const

export const sponsorshipFaqs = [
  {
    question: 'Will MarkText remain free and open source?',
    answer: 'Yes. MarkText will remain free and open source. Sponsorship is entirely voluntary.'
  },
  {
    question: 'Can I make a one-time contribution?',
    answer: 'Yes. GitHub Sponsors supports both one-time and monthly contributions.'
  },
  {
    question: 'How long will my company be featured?',
    answer:
      'Corporate sponsorship benefits remain active while your sponsorship is active, unless otherwise agreed.'
  },
  {
    question: 'How do I submit my company logo and link?',
    answer: `After becoming a corporate sponsor, please email your company name, logo, and preferred website URL to ${CORPORATE_EMAIL}.`
  },
  {
    question: 'Does sponsorship guarantee feature requests or priority support?',
    answer:
      'No. Sponsorship supports the project but does not guarantee specific features, development timelines, or priority support.'
  },
  {
    question: 'Can my company arrange an annual sponsorship?',
    answer: `Yes. For annual sponsorships or custom partnerships, please contact ${CORPORATE_EMAIL}.`
  }
] as const
