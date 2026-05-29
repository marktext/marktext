import type { CSSProperties, ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: ReactNode
  description: ReactNode
  className?: string
  style?: CSSProperties
  titleStyle?: CSSProperties
  descStyle?: CSSProperties
  children?: ReactNode
}

export default function FeatureCard({
  icon,
  title,
  description,
  className = 'card reveal',
  style,
  titleStyle,
  descStyle,
  children
}: Props) {
  return (
    <div className={className} style={style}>
      <div className="ic-lg">{icon}</div>
      <h3 style={titleStyle}>{title}</h3>
      <p style={descStyle}>{description}</p>
      {children}
    </div>
  )
}
