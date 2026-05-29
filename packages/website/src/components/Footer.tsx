'use client'

import { useRef, useEffect } from 'react'

const Footer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let rafId = 0

    const random = (min: number, max: number) => Math.random() * (max - min) + min

    const draw = () => {
      const time = new Date().getTime() * 0.002
      const color1 = 'rgba(238, 119, 82, .3)'
      const color2 = 'rgba(231, 60, 126, 0.4)'
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()

      const randomX = random(0.2, 0.9)
      const randomY = random(0.1, 0.2)

      const rectX = Math.cos(time * 1) * 1.5 + randomX
      const rectY = Math.sin(time * 1) * 1.5 + randomY
      const rectX2 = Math.cos(time * 0.7) * 3 + randomX
      const rectY2 = Math.sin(time * 0.7) * 3 + randomY
      const rectX3 = Math.cos(time * 1.4) * 4 + randomX
      const rectY3 = Math.sin(time * 1.4) * 4 + randomY

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
      gradient.addColorStop(0, color1)
      gradient.addColorStop(1, color2)
      ctx.fillStyle = gradient

      const triangle = (a: [number, number], b: [number, number], c: [number, number]) => {
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.lineTo(c[0], c[1])
        ctx.fill()
      }

      // group 1
      triangle([rectX2 + 120, rectY2 - 100], [rectX2 + 460, rectY2 + 80], [rectX2 + 26, rectY2 + 185])
      triangle([rectX - 50, rectY - 25], [rectX + 270, rectY + 25], [rectX - 50, rectY + 195])
      triangle([rectX3 - 140, rectY3 - 150], [rectX3 + 180, rectY3 + 210], [rectX3 - 225, rectY3 - 50])

      // group 2
      triangle([rectX + (canvas.width - 40), rectY - 30], [rectX + (canvas.width + 40), rectY + 190], [rectX + (canvas.width - 450), rectY + 120])
      triangle([rectX3 + (canvas.width - 200), rectY3 - 240], [rectX3 + (canvas.width + 80), rectY3 - 240], [rectX3 + (canvas.width - 50), rectY3 + 460])
      triangle([rectX2 + (canvas.width - 400), rectY2 + 140], [rectX2 + (canvas.width + 20), rectY2 + 200], [rectX2 + (canvas.width - 350), rectY2 + 370])

      // group 3
      triangle([rectX3 - 50, rectY3 + (canvas.height - 350)], [rectX3 + 350, rectY3 + (canvas.height - 220)], [rectX3 - 100, rectY3 + (canvas.height - 120)])
      triangle([rectX + 100, rectY + (canvas.height - 380)], [rectX + 320, rectY + (canvas.height - 180)], [rectX - 275, rectY + (canvas.height + 150)])
      triangle([rectX2 - 230, rectY2 + (canvas.height - 50)], [rectX2 + 215, rectY2 + (canvas.height - 110)], [rectX2 + 250, rectY2 + (canvas.height + 130)])

      // group 4
      triangle([rectX3 + (canvas.width - 80), rectY3 + (canvas.height - 320)], [rectX3 + (canvas.width + 250), rectY3 + (canvas.height + 220)], [rectX3 + (canvas.width - 200), rectY3 + (canvas.height + 140)])
      triangle([rectX + (canvas.width - 100), rectY + (canvas.height - 160)], [rectX + (canvas.width - 30), rectY + (canvas.height + 90)], [rectX + (canvas.width - 420), rectY + (canvas.height + 60)])
      triangle([rectX2 + (canvas.width - 320), rectY2 + (canvas.height - 200)], [rectX2 + (canvas.width - 50), rectY2 + (canvas.height - 20)], [rectX2 + (canvas.width - 420), rectY2 + (canvas.height + 120)])

      ctx.restore()
    }

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      draw()
    }

    animate()
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="footer">
      <div className="container hero">
        <div className="inner-wrapper">
          <img src="/assets/new_message.image.svg" alt="" />
          <h1>{'< Have Something to say? />'}</h1>
          <p>
            Send us an email <a href="mailto:ransixi@gmail.com">ransixi@gmail.com</a>
          </p>
          <p className="follow">
            <span>You can also follow us by</span>
            <a href="https://twitter.com/marktextapp" target="_blank" rel="noopener noreferrer">
              <img src="/assets/twitter.svg" alt="Twitter" className="icon" />
            </a>
            <a href="https://github.com/marktext/marktext" target="_blank" rel="noopener noreferrer">
              <img src="/assets/github.svg" alt="GitHub" className="icon" />
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
