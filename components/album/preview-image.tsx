'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DownloadIcon } from '~/components/icons/download'
import { LinkIcon } from '~/components/icons/link'
import { RefreshCWIcon } from '~/components/icons/refresh-cw'
import { CameraIcon } from '~/components/icons/camera'
import LivePhoto from '~/components/album/live-photo'
import { cn } from '~/lib/utils'
import type { PreviewImageHandleProps } from '~/types/props'

type BrowseOrder = 'timeDesc' | 'timeAsc' | 'nameAsc' | 'nameDesc'

const ORDER_LABEL: Record<BrowseOrder, string> = {
  timeDesc: '时间↓',
  timeAsc: '时间↑',
  nameAsc: '名称↑',
  nameDesc: '名称↓',
}

const iconButtonClass = 'grid h-9 w-9 place-items-center rounded-full border border-white/12 bg-white/[0.08] text-white/88 backdrop-blur-md transition hover:bg-white/[0.16] hover:text-white active:scale-95'

function safeGetInitialOrder(): BrowseOrder {
  if (typeof window === 'undefined') return 'timeDesc'
  const value = window.localStorage.getItem('galleryOrder') as BrowseOrder | null
  return value && value in ORDER_LABEL ? value : 'timeDesc'
}

function formatExifDate(value?: any) {
  if (!value) return ''
  return String(value).replace(/^([0-9]{4}):([0-9]{2}):([0-9]{2})/, '$1-$2-$3')
}

function cleanMetaValue(value?: any) {
  if (value === null || value === undefined) return ''
  const text = String(value).trim()
  // AList/OpenList 路径片段、无意义占位和 CSS/hash 片段不应被当成相机参数。
  if (!text || text === '#' || /^#?p$/i.test(text) || /^#?preview$/i.test(text)) return ''
  if (/^null$|^undefined$/i.test(text)) return ''
  return text
}

function cleanTagValue(value?: any) {
  const text = cleanMetaValue(value).replace(/^#+/, '').trim()
  if (!text || /^p$/i.test(text) || /^preview$/i.test(text)) return ''
  return text
}

function ExifPill({ label, value }: { label: string, value?: any }) {
  const displayValue = cleanMetaValue(value)
  if (!displayValue) return null
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs text-white/72">
      <span className="mr-1 text-white/42">{label}</span>{displayValue}
    </div>
  )
}

export default function PreviewImage(props: Readonly<PreviewImageHandleProps>) {
  const router = useRouter()
  const image = props.data
  const exif = image?.exif || {} as any
  const [order, setOrder] = React.useState<BrowseOrder>('timeDesc')
  const [ids, setIds] = React.useState<string[]>([])
  const [currentIndex, setCurrentIndex] = React.useState(-1)
  const [scale, setScale] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [dragging, setDragging] = React.useState(false)
  const [start, setStart] = React.useState({ x: 0, y: 0 })
  const [downloading, setDownloading] = React.useState(false)
  const [showInfo, setShowInfo] = React.useState(false)
  const imageWrapRef = React.useRef<HTMLDivElement>(null)

  const imageUrl = String(image?.url || image?.preview_url || image?.video_url || '')
  const previewUrl = String(image?.preview_url || image?.url || image?.video_url || '')
  const canPrev = currentIndex > 0
  const canNext = currentIndex >= 0 && currentIndex < ids.length - 1

  const close = React.useCallback(() => {
    router.push('/')
  }, [router])

  const goToId = React.useCallback((nextId?: string) => {
    if (!nextId) return
    router.replace(`/preview/${nextId}`)
  }, [router])

  const fetchImageIds = React.useCallback(async (nextOrder: BrowseOrder) => {
    try {
      const cacheKey = `preview-image-ids:${nextOrder}`
      const cached = window.sessionStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached) as { ids?: string[], expires?: number }
        if (Array.isArray(parsed.ids) && Number(parsed.expires) > Date.now()) {
          setIds(parsed.ids)
          setCurrentIndex(parsed.ids.findIndex((id: string) => String(id) === String(props.id)))
          return
        }
      }

      const response = await fetch(`/api/open/get-all-image-ids?order=${nextOrder}`, { cache: 'no-store' })
      const data = await response.json()
      const nextIds = Array.isArray(data?.ids) ? data.ids : []
      window.sessionStorage.setItem(cacheKey, JSON.stringify({ ids: nextIds, expires: Date.now() + 60_000 }))
      setIds(nextIds)
      setCurrentIndex(nextIds.findIndex((id: string) => String(id) === String(props.id)))
    } catch (error) {
      console.error('获取图片列表失败:', error)
    }
  }, [props.id])

  React.useEffect(() => {
    const initial = safeGetInitialOrder()
    setOrder(initial)
    fetchImageIds(initial)
  }, [fetchImageIds])

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowLeft' && canPrev) goToId(ids[currentIndex - 1])
      if (event.key === 'ArrowRight' && canNext) goToId(ids[currentIndex + 1])
      if (event.key === '0') resetTransform()
      if (event.key === '+' || event.key === '=') setScale((value) => Math.min(4, Number((value + 0.2).toFixed(2))))
      if (event.key === '-') setScale((value) => Math.max(0.5, Number((value - 0.2).toFixed(2))))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canNext, canPrev, close, currentIndex, goToId, ids])

  React.useEffect(() => { resetTransform() }, [props.id])

  function resetTransform() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function updateOrder(nextOrder: BrowseOrder) {
    setOrder(nextOrder)
    window.localStorage.setItem('galleryOrder', nextOrder)
    fetchImageIds(nextOrder)
    toast.success(`已切换浏览顺序：${ORDER_LABEL[nextOrder]}`)
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(imageUrl)
      toast.success('图片链接已复制')
    } catch { toast.error('复制失败') }
  }

  async function downloadImage() {
    if (!imageUrl) return
    try {
      setDownloading(true)
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${image?.title || image?.id || 'photo'}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch { toast.error('下载失败，可能是跨域限制') }
    finally { setDownloading(false) }
  }



  if (!image || !previewUrl) {
    return (
      <div className="fixed inset-0 z-[9990] grid place-items-center bg-[#050505] px-6 text-white">
        <div className="max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl shadow-black/50">
          <div className="text-lg font-semibold">预览图片加载失败</div>
          <p className="mt-3 text-sm leading-6 text-white/52">没有拿到可显示的图片地址。可能是图片还没绑定相册、直链为空，或者远程存储临时不可访问。</p>
          <button type="button" onClick={close} className="mt-5 rounded-full border border-white/12 bg-white/[0.08] px-5 py-2 text-sm text-white/86 transition hover:bg-white/[0.16]">返回首页</button>
        </div>
      </div>
    )
  }

  function onWheel(event: React.WheelEvent) {
    event.preventDefault()
    const next = Math.min(4, Math.max(0.5, scale + (event.deltaY > 0 ? -0.12 : 0.12)))
    setScale(Number(next.toFixed(2)))
  }

  function onPointerDown(event: React.PointerEvent) {
    if (scale <= 1) return
    setDragging(true)
    setStart({ x: event.clientX - offset.x, y: event.clientY - offset.y })
    imageWrapRef.current?.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!dragging || scale <= 1) return
    setOffset({ x: event.clientX - start.x, y: event.clientY - start.y })
  }

  function onPointerUp(event: React.PointerEvent) {
    setDragging(false)
    imageWrapRef.current?.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="fixed inset-0 z-[9990] overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(99,102,241,0.18),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(236,72,153,0.12),transparent_26%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(0,0,0,0.98))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.05),transparent_20%,transparent_78%,rgba(255,255,255,0.05))]" />

      <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
        <button type="button" onClick={() => setShowInfo((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm text-white/88 backdrop-blur-xl transition hover:bg-white/[0.16] hover:text-white active:scale-95" title="显示/隐藏相机参数">
          <CameraIcon size={16} />{showInfo ? '收起参数' : '相机参数'}
        </button>
        <button type="button" onClick={close} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm text-white/88 backdrop-blur-xl transition hover:bg-white/[0.16] hover:text-white active:scale-95" title="退出预览，快捷键 Esc">
          <span className="text-lg leading-none">×</span>退出 Esc
        </button>
      </div>

      <div className="absolute left-4 top-4 z-30 max-w-[calc(100vw-8rem)] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
        <div className="truncate text-sm font-medium text-white/92">{image?.title || '未命名图片'}</div>
        <div className="mt-1 truncate text-xs text-white/45">{currentIndex >= 0 ? `${currentIndex + 1} / ${ids.length || '?'}` : '图片预览'} · ← / → 翻页 · Esc 退出</div>
      </div>

      <div ref={imageWrapRef} className={cn('absolute inset-0 z-10 grid place-items-center p-4 md:p-12', showInfo && 'lg:pr-[25rem]')} onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={resetTransform}>
        {image?.type === 2 && image?.video_url ? (
          <div className="max-h-full max-w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/45">
            <LivePhoto url={previewUrl} videoUrl={image.video_url} className="h-[82vh] w-[88vw]" />
          </div>
        ) : (
          <img src={previewUrl} alt={image?.detail || image?.title || 'preview'} decoding="async" draggable={false} className={cn('max-h-[86vh] max-w-[92vw] select-none rounded-[1.4rem] border border-white/10 object-contain shadow-2xl shadow-black/55 transition-[filter,opacity] duration-200', scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in')} style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, transition: dragging ? 'none' : 'transform 160ms cubic-bezier(.22,1,.36,1)' }} onClick={() => scale <= 1 && setScale(1.45)} />
        )}
      </div>

      <button type="button" disabled={!canPrev} onClick={() => goToId(ids[currentIndex - 1])} className="absolute left-4 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-white/[0.08] text-2xl text-white/80 backdrop-blur-xl transition hover:bg-white/[0.16] disabled:pointer-events-none disabled:opacity-25" title="上一张，快捷键 ←">‹</button>
      <button type="button" disabled={!canNext} onClick={() => goToId(ids[currentIndex + 1])} className={cn('absolute right-4 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-white/[0.08] text-2xl text-white/80 backdrop-blur-xl transition hover:bg-white/[0.16] disabled:pointer-events-none disabled:opacity-25', showInfo && 'lg:right-[25.5rem]')} title="下一张，快捷键 →">›</button>

      {showInfo && <aside className="absolute bottom-20 right-4 top-20 z-30 hidden w-[23rem] overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 backdrop-blur-2xl lg:block">
        <div className="flex h-full flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/34">Photo Info</div>
            <h2 className="mt-2 line-clamp-2 text-lg font-semibold text-white/90">{image?.title || '未命名图片'}</h2>
            {image?.detail && <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/48">{image.detail}</p>}
          </div>
          {(() => {
            const cameraMeta = [
              { label: '相机', value: exif.make && exif.model ? `${exif.make} ${exif.model}` : exif.model },
              { label: '镜头', value: exif.lens_model || exif.lens_specification },
              { label: '焦距', value: exif.focal_length },
              { label: '光圈', value: exif.f_number },
              { label: '快门', value: exif.exposure_time },
              { label: 'ISO', value: exif.iso_speed_rating },
              { label: '时间', value: formatExifDate(exif.data_time) },
            ].filter((item) => cleanMetaValue(item.value))
            return cameraMeta.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {cameraMeta.map((item) => <ExifPill key={item.label} label={item.label} value={item.value} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/45">暂无可用相机参数</div>
            )
          })()}
          {Array.isArray(image?.labels) && image.labels.map(cleanTagValue).filter(Boolean).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {image.labels.map(cleanTagValue).filter(Boolean).map((tag: string) => <span key={tag} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/58">#{tag}</span>)}
            </div>
          )}
          <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-white/62">浏览顺序</span>
              <select value={order} onChange={(event) => updateOrder(event.target.value as BrowseOrder)} className="rounded-full border border-white/10 bg-white/[0.08] px-2 py-1 text-xs text-white outline-none">
                {(Object.keys(ORDER_LABEL) as BrowseOrder[]).map((item) => <option key={item} value={item} className="bg-neutral-950 text-white">{ORDER_LABEL[item]}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!canPrev} onClick={() => goToId(ids[currentIndex - 1])} className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white/72 disabled:opacity-30">上一张</button>
              <button type="button" disabled={!canNext} onClick={() => goToId(ids[currentIndex + 1])} className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-2 text-sm text-white/72 disabled:opacity-30">下一张</button>
            </div>
          </div>
        </div>
      </aside>}

      <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/12 bg-black/34 px-3 py-2 backdrop-blur-2xl">
        <button type="button" className={iconButtonClass} onClick={() => setScale((v) => Math.max(0.5, Number((v - 0.2).toFixed(2))))} title="缩小">−</button>
        <button type="button" className="min-w-14 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/78" onClick={resetTransform} title="双击图片也可以复位">{Math.round(scale * 100)}%</button>
        <button type="button" className={iconButtonClass} onClick={() => setScale((v) => Math.min(4, Number((v + 0.2).toFixed(2))))} title="放大">＋</button>
        <button type="button" className={iconButtonClass} onClick={copyUrl} title="复制链接"><LinkIcon size={18} /></button>
        <button type="button" className={iconButtonClass} onClick={downloadImage} title="下载">{downloading ? <RefreshCWIcon className="animate-spin" size={18} /> : <DownloadIcon size={18} />}</button>
      </div>
    </div>
  )
}
