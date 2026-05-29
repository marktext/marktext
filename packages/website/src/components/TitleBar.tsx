import React, { useState } from 'react'
import scrollToElement from '../utils/scrollTo'
import GitHubIcon from '../assets/github.svg?url'
import MacIcon from '../assets/mac.svg?url'
import WindowsIcon from '../assets/windows.svg?url'
import LinuxIcon from '../assets/linux.svg?url'
import logoImg from '../assets/logo.png'
import drinkCoffeeImg from '../assets/drink_coffee.image.svg'
import './TitleBar.css'

const TitleBar: React.FC = () => {
  const [isOpenNav, setIsOpenNav] = useState(false)

  const scrollTo = (selector: string, e: React.MouseEvent) => {
    e.preventDefault()
    scrollToElement(selector)
  }

  return (
    <div className="title-bar">
      <div className={`nav ${isOpenNav ? 'is-open' : ''}`}>
        <h1>
          <img src={logoImg} alt="marktext" />
          MarkText
        </h1>
        <div className="nav-group">
          <a href="#features" onClick={(e) => scrollTo('#features', e)}>Features</a>
          <a href="#themes" onClick={(e) => scrollTo('#themes', e)}>Themes</a>
          <a href="#sponsors" onClick={(e) => scrollTo('#sponsors', e)}>Sponsors</a>
          <a href="https://github.com/marktext/marktext" target="_blank" rel="noopener noreferrer">
            <img src={GitHubIcon} alt="GitHub" className="icon" />
            <span>GitHub</span>
          </a>
        </div>
        <button className="nav-button" onClick={() => setIsOpenNav(!isOpenNav)}></button>
      </div>
      <div className="title-content">
        <div className="des">
          <div className="slogan-text">Simple and Elegant Markdown Editor</div>
          <div className="slogan-text">Focused on speed and usability.</div>
          <div className="download-group">
            <div className="download-info">Available for macOS, Windows and Linux.</div>
            <div className="button-group">
              <a className="button" href="https://github.com/marktext/marktext/releases/latest/download/marktext-x64.dmg" target="_blank" rel="noopener noreferrer">
                <img src={MacIcon} alt="macOS" className="icon" />
                <span>macOS</span>
              </a>
              <a className="button" href="https://github.com/marktext/marktext/releases/latest/download/marktext-setup.exe" target="_blank" rel="noopener noreferrer">
                <img src={WindowsIcon} alt="Windows" className="icon" />
                <span>Windows</span>
              </a>
              <a className="button" href="https://github.com/marktext/marktext/releases/latest/download/marktext-x86_64.AppImage" target="_blank" rel="noopener noreferrer">
                <img src={LinuxIcon} alt="Linux" className="icon" />
                <span>Linux</span>
              </a>
            </div>
            <div className="releases">
              Or download on <a href="https://github.com/marktext/marktext/releases" target="_blank" rel="noopener noreferrer">GitHub</a> release page.
            </div>
          </div>
          <div className="inkio-section">
            <div className="inkio-text">Looking for MarkText-like editing with cloud storage? Try Inkio.</div>
            <a className="button inkio-button" href="https://www.inkio.me" target="_blank" rel="noopener noreferrer">
              <img src={MacIcon} alt="Inkio" className="icon" />
              <span>Inkio</span>
            </a>
          </div>
        </div>
        <div className="image">
          <img src={drinkCoffeeImg} alt="" />
        </div>
      </div>
    </div>
  )
}

export default TitleBar
