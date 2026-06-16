'use client'

import type { ImageHandleProps } from '~/types/props'
import useSWRInfinite from 'swr/infinite'
import { useTranslations } from 'next-intl'
import type { ImageType } from '~/types'
import { ReloadIcon } from '@radix-ui/react-icons'
import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import { MasonryPhotoAlbum, RenderImageContext, RenderImageProps } from 'react-photo-album'
import BlurImage from '~/components/album/blur-image'

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to load images')
  return response.json()
}

function renderNextImage(
  _: RenderImageProps,
  { photo }: RenderImageContext,
  dataList: ImageType[],
) {
  return <BlurImage photo={photo} dataList={dataList} />
}

function GallerySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index} className="relative overflow-hidden rounded-2xl bg-muted" style={{ height: index % 3 === 0 ? 260 : index % 3 === 1 ? 190 : 230 }}>
          <div className="image-skeleton" />
        </div>
      ))}
    </div>
  )
}

export default function AlbumGallery(props : Readonly<ImageHandleProps>) {
  const { data, isLoading, isValidating, size, setSize } = useSWRInfinite((index, previousPageData) => {
      if (previousPageData && Array.isArray(previousPageData.data) && previousPageData.data.length === 0) return null
      if (previousPageData?.totalPages && index >= Number(previousPageData.totalPages)) return null
      return `/api/v1/images/client-list?page=${index + 1}&album=${encodeURIComponent(props.album)}`
    }, fetcher, {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
      parallel: false,
    })

  const totalPages = Number(data?.[0]?.totalPages) || 9999
  const hasReachedEnd = Boolean(data?.some((page) => Array.isArray(page?.data) && page.data.length === 0))
  const dataList = useMemo(() => data ? data.flatMap((page) => Array.isArray(page?.data) ? page.data : []) : [], [data])
  const processedDataList = useMemo(() => {
    if (!props.randomShow) return dataList
    return [...dataList].sort(() => Math.random() - 0.5)
  }, [dataList, props.randomShow])
  const t = useTranslations()
  const loaderRef = useRef<HTMLDivElement>(null)

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting && !hasReachedEnd && !isLoading && !isValidating && totalPages > 0 && size < totalPages) {
      setSize((current) => current + 1)
    }
  }, [hasReachedEnd, isLoading, isValidating, setSize, size, totalPages])

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '900px 0px',
      threshold: 0,
    })
    const currentRef = loaderRef.current
    if (currentRef) observer.observe(currentRef)
    return () => { if (currentRef) observer.unobserve(currentRef) }
  }, [handleObserver])

  return (
    <div className="w-full p-2 space-y-4">
      <div className="flex w-full p-2 items-start justify-between sm:relative overflow-x-clip">
        <div className="hidden flex-1 px-2 sm:block" />
        <div className="w-full sm:w-[66.667%] mx-auto">
          {isLoading && processedDataList.length === 0 ? (
            <GallerySkeleton />
          ) : (
            <MasonryPhotoAlbum
              columns={(containerWidth) => {
                if (containerWidth < 768) return 2
                if (containerWidth < 1024) return 3
                return 4
              }}
              photos={processedDataList.map((item: ImageType) => ({
                src: item.preview_url || item.url,
                alt: item.detail || item.title,
                width: Number(item.width) > 0 ? Number(item.width) : 1200,
                height: Number(item.height) > 0 ? Number(item.height) : 800,
                ...item,
              }))}
              render={{image: (...args) => renderNextImage(...args, processedDataList)}}
            />
          )}
        </div>
        <div className="hidden flex-1 px-2 sm:block" />
      </div>
      <div ref={loaderRef} className="flex items-center justify-center my-4 py-6">
        {isValidating && processedDataList.length > 0 && <ReloadIcon className="h-5 w-5 animate-spin opacity-60" />}
        {!isValidating && hasReachedEnd && processedDataList.length > 0 && <div className="text-sm text-gray-500">已加载全部内容</div>}
        {!isLoading && !isValidating && processedDataList.length === 0 && <div className="text-sm text-gray-500">{t('Tips.noImg')}</div>}
      </div>
    </div>
  )
}
