import type { ReactNode } from 'react'
import { revealClass, type RevealDelay } from '@/lib/sections'

type Props = {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  delay?: RevealDelay
}

export default function FeatItem({ icon, title, description, delay }: Props) {
  return (
    <div className={revealClass(delay, 'feat-item')}>
      <div className="ic">{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </div>
  )
}
