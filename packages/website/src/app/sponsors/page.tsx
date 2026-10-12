import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import { BugIcon, ReleaseIcon, CommunityIcon, ServerIcon } from '@/components/Icons'
import Footer from '@/components/Footer'
import SponsorWall from '@/components/SponsorWall'
import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import {
  CORPORATE_CONTACT,
  CORPORATE_EMAIL,
  corporateTiers,
  individualTiers,
  fundingUses,
  sponsorshipFaqs
} from '@/lib/sponsorship'
import './sponsors.css'

export const dynamic = 'force-static'

const title = 'Sponsor MarkText | Support Open Source Development'
const description =
  'Support MarkText, the free and open-source Markdown editor. Explore individual and corporate sponsorship opportunities.'
const socialTitle = 'Sponsor MarkText — Keep Open Source Alive'
const socialDescription =
  'Help keep MarkText free, open source, and actively maintained. Explore individual and corporate sponsorship opportunities.'
const url = 'https://marktext.me/sponsors'

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: url },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'MarkText',
    url,
    title: socialTitle,
    description: socialDescription,
    images: [{ url: '/assets/logo.png', width: 512, height: 512, alt: 'MarkText logo' }]
  },
  twitter: {
    card: 'summary',
    title: socialTitle,
    description: socialDescription,
    images: ['/assets/logo.png']
  }
}

const fundingIcons = {
  bug: BugIcon,
  release: ReleaseIcon,
  community: CommunityIcon,
  server: ServerIcon
}

function SponsorLink({ children }: { children: React.ReactNode }) {
  return (
    <a className="btn btn-primary btn-lg" href={DOWNLOAD.sponsor} {...EXT_LINK}>
      {children}
    </a>
  )
}

export default function SponsorsPage() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav home={false} />
      <main className="sponsorship" id="main-content">
        <section className="sponsorship-hero wrap">
          <span className="kicker">SPONSORSHIP</span>
          <h1>Support MarkText.</h1>
          <p className="sec-desc">
            Help keep MarkText free, open source, and actively maintained for everyone.
          </p>
          <div className="hero-cta hero-cta--center">
            <SponsorLink>Become a Sponsor</SponsorLink>
          </div>
        </section>

        <section className="block wrap" aria-labelledby="why-sponsor">
          <div className="sec-head center">
            <h2 className="sec-title" id="why-sponsor">
              Why Sponsor MarkText?
            </h2>
            <p className="sec-desc">
              Maintaining an open-source application takes time and resources. Your sponsorship
              helps support:
            </p>
          </div>
          <div className="sponsorship-grid sponsorship-grid--two">
            {fundingUses.map((use) => {
              const Icon = fundingIcons[use.icon]
              return (
                <article className="sponsorship-card" key={use.title}>
                  <h3 className="funding-title">
                    <span className="funding-icon">
                      <Icon aria-hidden="true" focusable="false" />
                    </span>
                    {use.title}
                  </h3>
                  <p>{use.description}</p>
                </article>
              )
            })}
          </div>
          <p className="sponsorship-note">
            Every contribution helps keep MarkText free and open source.
          </p>
        </section>

        <section className="block wrap" aria-labelledby="individual-sponsorship">
          <div className="sec-head center">
            <h2 className="sec-title" id="individual-sponsorship">
              Support as an Individual
            </h2>
            <p className="sec-desc">
              Enjoy using MarkText? A small contribution helps us continue improving and maintaining
              the project.
            </p>
          </div>
          <div className="sponsorship-grid sponsorship-grid--two">
            {individualTiers.map((tier) => (
              <article className="sponsorship-card" key={tier.name}>
                <h3>
                  <span aria-hidden="true">{tier.icon} </span>
                  {tier.name}
                </h3>
                <p className="sponsorship-price">
                  ${tier.price} <span>/ month</span>
                </p>
                <p>{tier.description}</p>
                <SponsorLink>{tier.action}</SponsorLink>
              </article>
            ))}
          </div>
          <p className="sponsorship-note">
            Prefer a{' '}
            <a href={DOWNLOAD.sponsor} {...EXT_LINK}>
              one-time contribution
            </a>
            ? One-time sponsorships are also welcome.
          </p>
        </section>

        <section className="block wrap" aria-labelledby="corporate-sponsorship">
          <div className="sec-head center">
            <h2 className="sec-title" id="corporate-sponsorship">
              Become a Corporate Sponsor
            </h2>
            <p className="sec-desc">
              Support open source and get your company recognized across MarkText&apos;s website and
              GitHub presence.
            </p>
          </div>
          <div className="sponsorship-grid sponsorship-grid--three">
            {corporateTiers.map((tier) => (
              <article className="sponsorship-card" key={tier.id}>
                <h3>
                  <span aria-hidden="true">{tier.icon} </span>
                  {tier.name}
                </h3>
                <p className="sponsorship-price">
                  ${tier.price} <span>/ month</span>
                </p>
                <p>{tier.description}</p>
                <SponsorLink>{tier.action}</SponsorLink>
              </article>
            ))}
          </div>
          <table className="sponsorship-comparison">
            <caption>Corporate sponsorship benefits</caption>
            <thead>
              <tr>
                <th scope="col">Benefit</th>
                {corporateTiers.map((tier) => (
                  <th scope="col" key={tier.id}>
                    {tier.name.replace(' Sponsor', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Monthly price</th>
                {corporateTiers.map((tier) => (
                  <td key={tier.id}>${tier.price}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Website logo + link</th>
                {corporateTiers.map((tier) => (
                  <td key={tier.id}>Yes</td>
                ))}
              </tr>
              <tr>
                <th scope="row">GitHub README</th>
                {corporateTiers.map((tier) => (
                  <td key={tier.id}>{tier.readme ? 'Yes' : '—'}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">New release notes</th>
                {corporateTiers.map((tier) => (
                  <td key={tier.id}>{tier.releases ? 'Yes' : '—'}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">Display period</th>
                {corporateTiers.map((tier) => (
                  <td key={tier.id}>While active</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="sponsorship-contact">
            <h3>Need a custom sponsorship arrangement?</h3>
            <p>
              For annual sponsorships, custom partnerships, or questions about corporate
              sponsorship, contact us at <a href={CORPORATE_CONTACT}>{CORPORATE_EMAIL}</a>.
            </p>
            <a className="btn btn-ghost btn-lg" href={CORPORATE_CONTACT}>
              Contact Us
            </a>
          </div>
        </section>

        <section className="block wrap" aria-labelledby="our-sponsors">
          <div className="sec-head center">
            <h2 className="sec-title" id="our-sponsors">
              Our Sponsors
            </h2>
            <p className="sec-desc">
              We&apos;re grateful to the companies and individuals who help support MarkText.
            </p>
          </div>
          <SponsorWall placement="sponsors" />
        </section>

        <section className="block wrap" aria-labelledby="sponsorship-faq">
          <div className="sec-head center">
            <h2 className="sec-title" id="sponsorship-faq">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="sponsorship-faq">
            {sponsorshipFaqs.map((faq) => (
              <article key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="block wrap sponsorship-final">
          <h2 className="sec-title">Help keep MarkText moving forward.</h2>
          <p className="sec-desc">
            Every contribution helps us maintain and improve MarkText for the community.
          </p>
          <div className="hero-cta hero-cta--center">
            <SponsorLink>Sponsor MarkText</SponsorLink>
          </div>
        </section>
      </main>
      <Footer home={false} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: title,
            description,
            url
          })
        }}
      />
    </>
  )
}
