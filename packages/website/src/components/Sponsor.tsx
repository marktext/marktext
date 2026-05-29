import React from 'react'
import addIcon from '../assets/add.svg?url'
import openColIcon from '../assets/opencollective-icon.svg?url'
import colTextIcon from '../assets/logotype.svg?url'
import readmeLogo from '../assets/sponsor/readme.png'
import qordobaLogo from '../assets/sponsor/qordoba.png'
import './Sponsor.css'

interface SponsorItem {
  name: string
  link: string
  logo: string
}

const specialSponsors: SponsorItem[] = [
  {
    name: 'SerpApi',
    link: 'https://serpapi.com/?utm_source=marktext',
    logo: 'https://raw.githubusercontent.com/marktext/marktext/develop/docs/assets/sponsors/serpapi.png'
  }
]

const platinumSponsors: SponsorItem[] = [
  {
    name: 'readme',
    link: 'https://readme.io',
    logo: readmeLogo
  },
  {
    name: 'qordoba',
    link: 'https://qordoba.com',
    logo: qordobaLogo
  }
]

const Sponsor: React.FC = () => {
  return (
    <div className="sponsor">
      <div className="section-container">
        <h2 className="slogan" id="sponsors">$$ Sponsor $$</h2>
        <div className="sponsors">
          <h4>Special Sponsors</h4>
          <ul className="sponsors-list">
            {specialSponsors.map((sponsor) => (
              <li key={sponsor.name}>
                <a href={sponsor.link} target="_blank" rel="noopener noreferrer">
                  <img src={sponsor.logo} alt={sponsor.name} />
                </a>
              </li>
            ))}
          </ul>
          <h4>Platinum Sponsors</h4>
          <ul className="sponsors-list">
            {platinumSponsors.map((sponsor) => (
              <li key={sponsor.name}>
                <a href={sponsor.link} target="_blank" rel="noopener noreferrer">
                  <img src={sponsor.logo} alt={sponsor.name} />
                </a>
              </li>
            ))}
            <a href="https://opencollective.com/marktext#platinum-sponsors" target="_blank" rel="noopener noreferrer">
              <img src={addIcon} alt="Add" className="icon" />
            </a>
          </ul>
          <a href="https://opencollective.com/marktext#platinum-sponsors" target="_blank" rel="noopener noreferrer">
            <img src="https://opencollective.com/marktext/tiers/platinum-sponsors.svg?avatarHeight=36&width=600" alt="Platinum Sponsors" />
          </a>
          <h5>Bronze Sponsors</h5>
          <a href="https://opencollective.com/marktext#platinum-sponsors" target="_blank" rel="noopener noreferrer">
            <img src="https://opencollective.com/marktext/tiers/bronze-sponsors.svg?avatarHeight=36&width=600" alt="Bronze Sponsors" />
          </a>
        </div>
        <div className="ask-sponsor">
          <h4>Sponsor MarkText Development</h4>
          <p>
            MarkText is an MIT licensed open source project, you will always be able to download the latest version from{' '}
            <a href="https://github.com/marktext/marktext/releases" target="_blank" rel="noopener noreferrer">
              GitHub release page
            </a>
            . MarkText is still in development, and its development is inseparable from all sponsors. I hope you join them:
          </p>
          <div className="button-group">
            <a href="https://opencollective.com/marktext#platinum-sponsors" className="opencollective" target="_blank" rel="noopener noreferrer">
              <img src={openColIcon} alt="OpenCollective" className="icon" />
              <img src={colTextIcon} alt="Collective" className="text" />
            </a>
            <a href="https://www.patreon.com/ranluo" className="patreon" target="_blank" rel="noopener noreferrer">
              <img src={new URL('../assets/patreon.webp', import.meta.url).href} alt="patreon" />
              Become A Patreon
            </a>
          </div>
          <div>
            <strong>What's the difference between Patreon and OpenCollective?</strong>
            <div className="description">
              <div>
                <p>
                  Sponsored by Patreon, goes directly to support Ran Luo's work on MarkText. Sponsored by Open Collective, all expenses are transparent, and used for the development of MarkText.
                </p>
                <strong>
                  We also accept{' '}
                  <a href="https://github.com/Jocs/sponsor.me" target="_blank" rel="noopener noreferrer">
                    One Time Donations
                  </a>
                </strong>
              </div>
              <div className="description-image">
                <img src={new URL('../assets/do_code.image.svg', import.meta.url).href} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sponsor
