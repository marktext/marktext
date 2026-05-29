import type { CSSProperties, ReactNode } from 'react'
import { MenuIcon, SearchIcon } from './Icons'

type Props = {
  title: string
  showActions?: boolean
  windowId?: string
  windowRef?: React.Ref<HTMLDivElement>
  docStyle?: CSSProperties
  children: ReactNode
}

export default function MockWindow({
  title,
  showActions = false,
  windowId,
  windowRef,
  docStyle,
  children
}: Props) {
  return (
    <div className="window" id={windowId} ref={windowRef}>
      <div className="win-bar">
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="win-title">
          <span className="dot" /> {title}
        </div>
        {showActions && (
          <div className="win-actions">
            <SearchIcon />
            <MenuIcon />
          </div>
        )}
      </div>
      <div className="doc" style={docStyle}>
        {children}
      </div>
    </div>
  )
}
