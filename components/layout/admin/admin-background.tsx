'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'

const ADMIN_BG_URL = 'https://pic.rmb.bdstatic.com/bjh/ebe942a9de49856f389c65f25a338335.png'

export function AdminBackground() {
  const { resolvedTheme } = useTheme()
  const [loaded, setLoaded] = React.useState(false)
  const isDark = resolvedTheme === 'dark'
  const enableRemoteBackground = process.env.NEXT_PUBLIC_ENABLE_ADMIN_BACKGROUND === 'true'

  React.useEffect(() => {
    if (!enableRemoteBackground) {
      setLoaded(false)
      return
    }

    let cancelled = false
    const image = new Image()
    image.decoding = 'async'
    image.loading = 'lazy'
    image.onload = () => {
      if (!cancelled) setLoaded(true)
    }
    image.onerror = () => {
      if (!cancelled) setLoaded(false)
    }
    const timeoutId = window.setTimeout(() => { image.src = ADMIN_BG_URL }, 1200)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [enableRemoteBackground])

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.13),transparent_30%),radial-gradient(circle_at_84%_6%,rgba(236,72,153,0.10),transparent_26%),linear-gradient(135deg,rgba(248,250,252,0.90),rgba(226,232,240,0.72))] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(99,102,241,0.18),transparent_34%),radial-gradient(circle_at_84%_6%,rgba(236,72,153,0.12),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.95),rgba(15,23,42,0.88))]" />
      <div
        aria-hidden
        className="absolute inset-[-16px] bg-center bg-cover opacity-0 transition-opacity duration-700"
        style={{
          backgroundImage: loaded ? `url(${ADMIN_BG_URL})` : undefined,
          opacity: loaded ? 0.26 : 0,
          filter: `${isDark ? 'brightness(0.55)' : 'brightness(1.02)'} saturate(102%) contrast(100%) blur(8px)`
        }}
      />
      <div className="absolute inset-0 bg-background/70 dark:bg-background/78 backdrop-blur-[4px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/90" />
    </div>
  )
}
