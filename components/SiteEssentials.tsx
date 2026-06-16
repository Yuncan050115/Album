// components/SiteEssentials.tsx
'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { create } from 'zustand'

interface MouseStore {
  position: [number, number]
  velocity: number
  update: (pos: [number, number], vel: number) => void
}

export const useMouseStore = create<MouseStore>((set) => ({
  position: [0, 0],
  velocity: 0,
  update: (pos, vel) => set({ position: pos, velocity: vel })
}))

const BACKGROUND_URL = {
  light: 'https://apir.yuncan.xyz/light.php',
  dark: 'https://apir.yuncan.xyz/dark.php'
}

export function DynamicBackground() {
  const { resolvedTheme } = useTheme()
  const [loadedUrl, setLoadedUrl] = React.useState<string>('')
  const [mounted, setMounted] = React.useState(false)
  const isDark = resolvedTheme === 'dark'
  const bgUrl = isDark ? BACKGROUND_URL.dark : BACKGROUND_URL.light
  const disableRemoteBackground = process.env.NEXT_PUBLIC_ENABLE_REMOTE_BACKGROUND === 'false'

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    if (!mounted || disableRemoteBackground) {
      setLoadedUrl('')
      return
    }

    let cancelled = false
    const image = new Image()
    image.decoding = 'async'
    image.loading = 'eager'
    image.onload = () => !cancelled && setLoadedUrl(bgUrl)
    image.onerror = () => !cancelled && setLoadedUrl('')

    const start = () => { image.src = bgUrl }
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(start, { timeout: 700 })
      return () => {
        cancelled = true
        window.cancelIdleCallback(idleId)
      }
    }

    const timeoutId = window.setTimeout(start, 160)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [bgUrl, disableRemoteBackground, mounted])

  return (
    <div className="site-background fixed inset-0 z-[-1] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(148,163,184,0.30),transparent_34%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.18),transparent_30%),linear-gradient(135deg,rgba(248,250,252,0.95),rgba(226,232,240,0.86))] dark:bg-[radial-gradient(circle_at_20%_15%,rgba(99,102,241,0.20),transparent_35%),radial-gradient(circle_at_80%_12%,rgba(236,72,153,0.16),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(15,23,42,0.88))]" />
      <div
        aria-hidden
        className="absolute inset-[-18px] scale-[1.03] bg-center bg-cover opacity-0 transition-opacity duration-1000 ease-out motion-reduce:transition-none"
        style={{
          backgroundImage: loadedUrl ? `url(${loadedUrl})` : undefined,
          opacity: loadedUrl ? 0.46 : 0,
          filter: isDark ? 'saturate(115%) contrast(105%) brightness(0.72)' : 'saturate(106%) contrast(98%) brightness(1.04)'
        }}
      />
      <div className="absolute inset-0 backdrop-blur-[10px] bg-background/28 dark:bg-background/48" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/25 to-background" />
    </div>
  )
}

function isInteractiveElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('a, button, input, textarea, select, [role="button"], [data-cursor="interactive"], .cursor-pointer, .interactive-surface'))
}

function isTextElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'))
}

function spawnCursorBurst(x: number, y: number) {
  const container = document.createElement('div')
  container.className = 'cursor-burst'
  container.style.left = `${x}px`
  container.style.top = `${y}px`
  for (let i = 0; i < 18; i++) {
    const ray = document.createElement('i')
    ray.style.setProperty('--angle', `${i * 20}deg`)
    ray.style.setProperty('--distance', `${26 + (i % 6) * 5}px`)
    container.appendChild(ray)
  }
  document.body.appendChild(container)
  window.setTimeout(() => container.remove(), 720)
}

function updateInteractiveSurface(event: PointerEvent) {
  if (!(event.target instanceof Element)) return
  const surface = event.target.closest('.interactive-surface') as HTMLElement | null
  if (!surface) return
  const rect = surface.getBoundingClientRect()
  surface.style.setProperty('--surface-x', `${event.clientX - rect.left}px`)
  surface.style.setProperty('--surface-y', `${event.clientY - rect.top}px`)
}

export function MagicCursor() {
  const dotRef = React.useRef<HTMLDivElement>(null)
  const ringRef = React.useRef<HTMLDivElement>(null)
  const rafRef = React.useRef<number | null>(null)
  const targetRef = React.useRef({ x: 0, y: 0 })
  const ringRefPos = React.useRef({ x: 0, y: 0 })
  const previousRef = React.useRef({ x: 0, y: 0, time: 0 })
  const lastStoreUpdateRef = React.useRef(0)
  const updateMouseStore = useMouseStore((state) => state.update)

  React.useEffect(() => {
    const pointerFine = window.matchMedia('(pointer: fine)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dot = dotRef.current
    const ring = ringRef.current

    if (!pointerFine || !dot || !ring) {
      dot?.setAttribute('hidden', 'true')
      ring?.setAttribute('hidden', 'true')
      document.documentElement.classList.remove('magic-cursor-enabled')
      return
    }

    document.documentElement.classList.add('magic-cursor-enabled')

    const setCursorMode = (target: EventTarget | null) => {
      const root = document.documentElement
      root.classList.toggle('cursor-is-interactive', isInteractiveElement(target))
      root.classList.toggle('cursor-is-text', isTextElement(target))
    }

    const animate = () => {
      const { x, y } = targetRef.current
      const ringPos = ringRefPos.current
      const ease = reducedMotion ? 1 : 0.30
      ringPos.x += (x - ringPos.x) * ease
      ringPos.y += (y - ringPos.y) * ease

      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`
      rafRef.current = requestAnimationFrame(animate)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const now = performance.now()
      const prev = previousRef.current
      const dx = event.clientX - prev.x
      const dy = event.clientY - prev.y
      const dt = Math.max(now - prev.time, 12)
      const velocity = Math.hypot(dx, dy) / dt

      targetRef.current = { x: event.clientX, y: event.clientY }
      previousRef.current = { x: event.clientX, y: event.clientY, time: now }
      updateInteractiveSurface(event)
      if (now - lastStoreUpdateRef.current > 72) {
        lastStoreUpdateRef.current = now
        updateMouseStore([event.clientX, event.clientY], velocity)
      }
      setCursorMode(event.target)
    }

    const handlePointerDown = (event: PointerEvent) => {
      document.documentElement.classList.add('cursor-is-down')
      if (event.pointerType === 'mouse') spawnCursorBurst(event.clientX, event.clientY)
    }
    const handlePointerUp = () => document.documentElement.classList.remove('cursor-is-down')
    const handlePointerLeave = () => document.documentElement.classList.add('cursor-is-hidden')
    const handlePointerEnter = () => document.documentElement.classList.remove('cursor-is-hidden')

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true })
    window.addEventListener('pointerenter', handlePointerEnter, { passive: true })
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      document.documentElement.classList.remove('magic-cursor-enabled', 'cursor-is-interactive', 'cursor-is-text', 'cursor-is-down', 'cursor-is-hidden')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('pointerenter', handlePointerEnter)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [updateMouseStore])

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden />
      <div ref={ringRef} className="cursor-ring" aria-hidden />
    </>
  )
}

export function Footer() {
  const { resolvedTheme } = useTheme()
  const pathname = usePathname()
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/preview') || pathname?.startsWith('/login')) return null
  const isDark = resolvedTheme === 'dark'
  const gradientConfig = {
    light: {
      bg: 'from-white/55 to-slate-100/50',
      shadow: 'shadow-[0_8px_32px_rgba(15,23,42,0.08)]',
      border: 'border-slate-200/60',
      svgGradient: ['#6366f1', '#8b5cf6'],
      glow: '#6366f1'
    },
    dark: {
      bg: 'from-slate-900/48 to-slate-800/38',
      shadow: 'shadow-[0_8px_32px_rgba(255,255,255,0.07)]',
      border: 'border-white/10',
      svgGradient: ['#a855f7', '#ec4899'],
      glow: '#a855f7'
    }
  }

  const { bg, shadow, border, svgGradient, glow } = isDark ? gradientConfig.dark : gradientConfig.light

  const handleFooterPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--footer-x', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--footer-y', `${event.clientY - rect.top}px`)
  }

  return (
    <footer className="pointer-events-none fixed bottom-4 inset-x-0 z-40 text-center">
      <div onPointerMove={handleFooterPointerMove} className={`footer-orbit pointer-events-auto inline-flex px-5 py-2.5 rounded-2xl backdrop-blur-xl bg-gradient-to-r ${bg} ${shadow} border ${border} transition-transform duration-200 hover:-translate-y-0.5 group relative overflow-hidden isolate`}>
        <p className="relative z-10 text-sm font-medium text-slate-700 dark:text-slate-100 flex items-center select-none">
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-indigo-600 dark:hover:text-fuchsia-300">
            晋ICP备2024030642号-1 | Refactor by Yuncan
          </a>
          <a href="https://yuncan.xyz" target="_blank" rel="noopener noreferrer" className="ml-2 transition-colors hover:text-purple-500 dark:hover:text-pink-300" title="进入个人站" aria-label="进入个人站">
            <svg viewBox="0 0 100 100" className="w-5 h-5 ml-1" style={{ filter: `drop-shadow(0 2px 4px ${glow}30)` }}>
              <linearGradient id="footerGradient" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={svgGradient[0]} />
                <stop offset="100%" stopColor={svgGradient[1]} />
              </linearGradient>
              <path d="M50 15a35 35 0 1 1 0 70 35 35 0 0 1 0-70zm0 10c-13.8 0-25 11.2-25 25s11.2 25 25 25 25-11.2 25-25-11.2-25-25-25z" fill="url(#footerGradient)" stroke="currentColor" strokeWidth="2" />
            </svg>
          </a>
        </p>
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-30"
          style={{
            '--glow-color': glow,
            background: 'radial-gradient(140px circle at var(--footer-x, 50%) var(--footer-y, 50%), var(--glow-color), transparent 64%)',
            mixBlendMode: isDark ? 'screen' : 'multiply'
          } as React.CSSProperties}
        />
      </div>
    </footer>
  )
}
