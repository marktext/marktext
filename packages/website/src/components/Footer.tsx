import React, { useRef, useEffect } from 'react'
import TwitterIcon from '../assets/twitter.svg?url'
import GitHubIcon from '../assets/github.svg?url'
import './Footer.css'

const Footer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // ===========================================
    // Hero Animated Canvas Background
    // by Mário Duarte
    // (╭☞ ͡ ͡°͜ ʖ ͡ ͡°)╭☞
    // Thanks for stoping by, don't forget to like
    // and follow to stay up to date with new
    // doodles and cools stuff
    // Twitter: https://twitter.com/MDesignsuk
    //  (づ｡◕‿‿◕｡)づ
    // ===========================================

    // pure javascript random function
    function random(min: number, max: number): number {
      return Math.random() * (max - min) + min
    }

    const draw = () => {
      // setup canvas environment
      const time = new Date().getTime() * 0.002
      const color1 = 'rgba(238, 119, 82, .3)'
      const color2 = 'rgba(231, 60, 126, 0.4)'
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()

      // random float to be used in the sin & cos
      const randomX = random(0.2, 0.9)
      const randomY = random(0.1, 0.2)

      // sin & cos for the movement of the triangles in the canvas
      const rectX = Math.cos(time * 1) * 1.5 + randomX
      const rectY = Math.sin(time * 1) * 1.5 + randomY
      const rectX2 = Math.cos(time * 0.7) * 3 + randomX
      const rectY2 = Math.sin(time * 0.7) * 3 + randomY
      const rectX3 = Math.cos(time * 1.4) * 4 + randomX
      const rectY3 = Math.sin(time * 1.4) * 4 + randomY

      // triangle gradient
      const triangle_gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      triangle_gradient.addColorStop(0, color1)
      triangle_gradient.addColorStop(1, color2)

      // triangle group 1
      // triangle 1.1
      ctx.beginPath()
      ctx.moveTo(rectX2 + 120, rectY2 - 100)
      ctx.lineTo(rectX2 + 460, rectY2 + 80)
      ctx.lineTo(rectX2 + 26, rectY2 + 185)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 1.2
      ctx.beginPath()
      ctx.moveTo(rectX - 50, rectY - 25)
      ctx.lineTo(rectX + 270, rectY + 25)
      ctx.lineTo(rectX - 50, rectY + 195)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 1.3
      ctx.beginPath()
      ctx.moveTo(rectX3 - 140, rectY3 - 150)
      ctx.lineTo(rectX3 + 180, rectY3 + 210)
      ctx.lineTo(rectX3 - 225, rectY3 - 50)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle group 2
      // triangle 2.1
      ctx.beginPath()
      ctx.moveTo(rectX + (canvas.width - 40), rectY - 30)
      ctx.lineTo(rectX + (canvas.width + 40), rectY + 190)
      ctx.lineTo(rectX + (canvas.width - 450), rectY + 120)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 2.2
      ctx.beginPath()
      ctx.moveTo(rectX3 + (canvas.width - 200), rectY3 - 240)
      ctx.lineTo(rectX3 + (canvas.width + 80), rectY3 - 240)
      ctx.lineTo(rectX3 + (canvas.width - 50), rectY3 + 460)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 2.3
      ctx.beginPath()
      ctx.moveTo(rectX2 + (canvas.width - 400), rectY2 + 140)
      ctx.lineTo(rectX2 + (canvas.width + 20), rectY2 + 200)
      ctx.lineTo(rectX2 + (canvas.width - 350), rectY2 + 370)
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle group 3
      // triangle 3.1
      ctx.beginPath()
      ctx.moveTo(rectX3 - 50, rectY3 + (canvas.height - 350))
      ctx.lineTo(rectX3 + 350, rectY3 + (canvas.height - 220))
      ctx.lineTo(rectX3 - 100, rectY3 + (canvas.height - 120))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 3.2
      ctx.beginPath()
      ctx.moveTo(rectX + 100, rectY + (canvas.height - 380))
      ctx.lineTo(rectX + 320, rectY + (canvas.height - 180))
      ctx.lineTo(rectX - 275, rectY + (canvas.height + 150))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 3.3
      ctx.beginPath()
      ctx.moveTo(rectX2 - 230, rectY2 + (canvas.height - 50))
      ctx.lineTo(rectX2 + 215, rectY2 + (canvas.height - 110))
      ctx.lineTo(rectX2 + 250, rectY2 + (canvas.height + 130))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle group 4
      // triangle 4.1
      ctx.beginPath()
      ctx.moveTo(rectX3 + (canvas.width - 80), rectY3 + (canvas.height - 320))
      ctx.lineTo(rectX3 + (canvas.width + 250), rectY3 + (canvas.height + 220))
      ctx.lineTo(rectX3 + (canvas.width - 200), rectY3 + (canvas.height + 140))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 4.2
      ctx.beginPath()
      ctx.moveTo(rectX + (canvas.width - 100), rectY + (canvas.height - 160))
      ctx.lineTo(rectX + (canvas.width - 30), rectY + (canvas.height + 90))
      ctx.lineTo(rectX + (canvas.width - 420), rectY + (canvas.height + 60))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      // triangle 4.3
      ctx.beginPath()
      ctx.moveTo(rectX2 + (canvas.width - 320), rectY2 + (canvas.height - 200))
      ctx.lineTo(rectX2 + (canvas.width - 50), rectY2 + (canvas.height - 20))
      ctx.lineTo(rectX2 + (canvas.width - 420), rectY2 + (canvas.height + 120))
      ctx.fillStyle = triangle_gradient
      ctx.fill()

      ctx.restore()
    }

    function animate() {
      requestAnimationFrame(animate)
      draw()
    }

    // Start animation
    animate()
  }, [])

  return (
    <div className="footer">
      <div className="container hero">
        <div className="inner-wrapper">
          <img src={new URL('../assets/new_message.image.svg', import.meta.url).href} alt="" />
          <h1>&lt; Have Something to say? /&gt;</h1>
          <p>
            Send us an email <a href="mailto:ransixi@gmail.com">ransixi@gmail.com</a>
          </p>
          <p className="follow">
            <span>You can also follow us by</span>
            <a href="https://twitter.com/marktextapp" target="_blank" rel="noopener noreferrer">
              <img src={TwitterIcon} alt="Twitter" className="icon" />
            </a>
            <a href="https://github.com/marktext/marktext" target="_blank" rel="noopener noreferrer">
              <img src={GitHubIcon} alt="GitHub" className="icon" />
            </a>
          </p>
          <p className="small">
            All Right Reserved © 2017-Now{' '}
            <a href="https://github.com/Jocs" target="_blank" rel="noopener noreferrer">
              @jocs
            </a>
          </p>
        </div>
        <div className="overlay"></div>
        <div className="background">
          <canvas id="hero-canvas" width="1920" height="1080" ref={canvasRef}></canvas>
        </div>
      </div>
    </div>
  )
}

export default Footer
