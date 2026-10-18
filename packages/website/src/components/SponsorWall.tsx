import { sponsors } from '@/lib/sponsorship'
import { EXT_LINK } from '@/lib/links'

const rank = { early: 0, platinum: 1, gold: 2, community: 3 }

export default function SponsorWall({ placement }: { placement: 'home' | 'sponsors' }) {
  const visible = sponsors
    .filter(
      (sponsor) => (sponsor.active || sponsor.permanent) && sponsor.placements.includes(placement)
    )
    .sort((a, b) => rank[a.tier] - rank[b.tier] || a.order - b.order)

  return (
    <div className="sponsors-wall">
      {placement === 'home' && <span className="sponsors-label">Sponsored by</span>}
      <div className="sponsor-logos">
        {visible.map((sponsor) => (
          <div key={sponsor.name} className={`sponsor-entry sponsor-entry--${sponsor.tier}`}>
            <a className="sponsor-logo" href={sponsor.url} {...EXT_LINK} title={sponsor.name}>
              {sponsor.logo ? (
                <img
                  src={sponsor.logo.src}
                  alt={sponsor.name}
                  width={sponsor.logo.width}
                  height={sponsor.logo.height}
                  loading="lazy"
                  className={sponsor.logo.preserveColors ? 'sponsor-logo-raw' : undefined}
                />
              ) : (
                sponsor.name
              )}
            </a>
            {placement === 'sponsors' && (
              <p className="sponsor-badge">
                {sponsor.tier === 'early'
                  ? 'Early Supporter'
                  : `${sponsor.tier[0].toUpperCase()}${sponsor.tier.slice(1)} Sponsor`}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
