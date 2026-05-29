'use client'

import { useEffect, useRef } from 'react'
import { useReveal } from '@/hooks/useReveal'
import { useCardGlow } from '@/hooks/useCardGlow'

export default function PageEffects() {
  const bodyRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    bodyRef.current = document.body
  }, [])

  useReveal()
  useCardGlow(bodyRef)
  return null
}
