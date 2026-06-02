import { DOWNLOAD } from '@/lib/downloads'
import { EXT_LINK } from '@/lib/links'
import { SECTIONS } from '@/lib/sections'
import { HeartIcon } from './Icons'

export default function Support() {
  return (
    <section className="block" id={SECTIONS.support}>
      <div className="wrap">
        <div className="sec-head center reveal">
          <span className="kicker">Support</span>
          <h2 className="sec-title">Keep MarkText free.</h2>
          <p className="sec-desc">
            Built by volunteers. If it earns a place in your workflow, sponsorship keeps development
            going.
          </p>
          <div className="hero-cta hero-cta--center">
            <a className="btn btn-primary btn-lg" href={DOWNLOAD.sponsor} {...EXT_LINK}>
              <HeartIcon />
              Sponsor on GitHub
            </a>
          </div>
        </div>

        <div className="sponsors-wall reveal d1">
          <span className="sponsors-label">Sponsored by</span>
          <a className="sponsor-logo" href={DOWNLOAD.serpapi} {...EXT_LINK} title="SerpApi">
            <img src="/assets/serpapi.png" alt="SerpApi" loading="lazy" />
          </a>
        </div>
      </div>
    </section>
  )
}
