import type { ReactNode } from 'react'
import { revealClass, type RevealDelay } from '@/lib/sections'

type Props = {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  delay?: RevealDelay
  variant?: 'lg'
  children?: ReactNode
}

export default function FeatureCard({ icon, title, description, delay, variant, children }: Props) {
  const base = variant === 'lg' ? 'card card--lg' : 'card'
  return (
    <div className={revealClass(delay, base)}>
      <div className="ic-lg">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  )
}
