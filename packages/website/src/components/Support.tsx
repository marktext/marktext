import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS } from '@/lib/sections'
import Link from 'next/link'
import SponsorWall from './SponsorWall'
import { HeartIcon } from './Icons'

export default function Support() {
  return (
    <section className="block" id={SECTIONS.support}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">SUPPORT MARKTEXT</span>
          <h2 className="sec-title">Keep MarkText free and open source.</h2>
          <p className="sec-desc">
            MarkText is free for everyone. Your support helps fund bug fixes, new releases,
            community contributions, and essential infrastructure.
          </p>
          <div className="hero-cta hero-cta--center">
            <a className="btn btn-primary btn-lg" href={DOWNLOAD.sponsor} {...EXT_LINK}>
              <HeartIcon />
              Sponsor on GitHub
            </a>
            <Link className="btn btn-ghost btn-lg" href="/sponsors">
              Explore Sponsorships
            </Link>
          </div>
        </div>

        <SponsorWall placement="home" />
      </div>
    </section>
  )
}
