'use client'

import { useReveal } from '@/hooks/useReveal'
import { useCardGlow } from '@/hooks/useCardGlow'

export default function PageEffects() {
  useReveal()
  useCardGlow()
  return null
}
