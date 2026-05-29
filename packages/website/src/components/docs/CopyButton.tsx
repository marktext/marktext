'use client'

import { useEffect } from 'react'

/**
 * Mounts a single delegated click handler that turns every server-rendered
 * `.copy-btn` (emitted by `wrapCodeBlock` in `lib/markdown.ts`) into a working
 * clipboard button — without per-button hydration cost.
 */
export default function CopyButton() {
  useEffect(() => {
    function handler(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null
      const btn = target?.closest('.copy-btn') as HTMLButtonElement | null
      if (!btn) return
      ev.preventDefault()
      const text =
        btn.getAttribute('data-copy') ??
        btn.closest('.code')?.querySelector('pre')?.textContent ??
        ''
      copyToClipboard(text)
      const label = btn.querySelector('.label')
      const original = label?.textContent
      btn.classList.add('done')
      if (label) label.textContent = 'Copied'
      window.setTimeout(() => {
        btn.classList.remove('done')
        if (label && original) label.textContent = original
      }, 1600)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])
  return null
}

function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text)
      return
    }
  } catch {
    /* fall through */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta)
}
