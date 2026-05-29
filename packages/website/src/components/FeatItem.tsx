import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  delay?: 'd1' | 'd2' | 'd3' | 'd4'
}

export default function FeatItem({ icon, title, description, delay }: Props) {
  return (
    <div className={`feat-item reveal${delay ? ` ${delay}` : ''}`}>
      <div className="ic">{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </div>
  )
}
