'use client'

import * as React from 'react'
import { useRouter } from 'next-nprogress-bar'
import { cn } from '~/lib/utils'

export default function BlurImage({ photo }: { photo: any, dataList: any }) {
  const router = useRouter()
  const [loaded, setLoaded] = React.useState(false)
  const width = Number(photo.width) > 0 ? Number(photo.width) : 1200
  const height = Number(photo.height) > 0 ? Number(photo.height) : 800

  return (
    <button
      type="button"
      className="interactive-surface group relative inline-block select-none overflow-hidden rounded-2xl border border-white/10 bg-muted text-left shadow-sm shadow-gray-200/70 dark:shadow-black/30"
      onClick={() => router.push(`/preview/${photo?.id}`)}
      aria-label={photo.alt || photo.title || '查看图片'}
      style={{ contentVisibility: 'auto', containIntrinsicSize: `${Math.round(height / width * 320)}px` }}
    >
      {!loaded && <div className="image-skeleton" />}
      <img
        className={cn('relative z-0 block h-auto w-full cursor-pointer object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
        width={width}
        height={height}
        src={photo.src}
        alt={photo.alt || photo.title || ''}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onLoad={() => setLoaded(true)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      {photo.type === 2 && (
        <div className="absolute left-2 top-2 rounded-full bg-black/45 p-2 text-white backdrop-blur">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-90" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="9" strokeDasharray="2 4" />
          </svg>
        </div>
      )}
    </button>
  )
}
