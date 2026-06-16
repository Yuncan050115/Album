// components/layout/header.tsx
import Logo from '~/components/layout/logo'
import type { AlbumDataProps } from '~/types/props'
import HeaderIconGroup from '~/components/layout/header-icon-group'

export default async function Header(props: Readonly<AlbumDataProps>) {
  return (
    <header className="sticky top-3 z-50 mx-auto mt-3 w-[min(1160px,calc(100vw-1.25rem))] px-0">
      <div className="interactive-surface group relative flex min-h-[4.65rem] items-center overflow-visible rounded-[2.25rem] border border-white/22 bg-white/[0.075] px-3 py-3 shadow-[0_18px_65px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.12] dark:border-white/8 dark:bg-black/[0.075] dark:shadow-[0_18px_65px_rgba(0,0,0,0.18)] dark:hover:bg-black/[0.12] sm:px-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-18%,rgba(255,255,255,0.34),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_55%,rgba(255,255,255,0.05))] opacity-55 dark:bg-[radial-gradient(circle_at_50%_-18%,rgba(168,85,247,0.13),transparent_44%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_55%,rgba(236,72,153,0.04))]" />
        <div className="relative z-10 hidden shrink-0 sm:block">
          <Logo />
        </div>
        <div className="relative z-10 flex min-w-0 flex-1 justify-center px-2 text-center sm:px-4">
          <h1 className="font-moqugufeng truncate py-1 text-[1.52rem] leading-[1.28] tracking-[0.22em] text-slate-950/86 drop-shadow-[0_1px_12px_rgba(255,255,255,0.48)] dark:text-white/88 dark:drop-shadow-[0_1px_18px_rgba(168,85,247,0.26)] sm:text-3xl md:text-[2rem]">
            云笺藏霁月 镜底锁烟霞
          </h1>
        </div>
        <div className="relative z-10 flex shrink-0 items-center justify-end">
          <HeaderIconGroup {...props} />
        </div>
      </div>
    </header>
  )
}
