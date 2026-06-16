'use client'

import type { ImageHandleProps } from '~/types/props'
import useSWRInfinite from 'swr/infinite'
import { useTranslations } from 'next-intl'
import type { ImageType } from '~/types'
import { ReloadIcon } from '@radix-ui/react-icons'
import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import GalleryImage from '~/components/album/gallery-image'

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('Failed to load images')
  return response.json()
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="relative mx-auto h-72 w-full max-w-4xl overflow-hidden rounded-3xl bg-muted">
          <div className="image-skeleton" />
        </div>
      ))}
    </div>
  )
}

export default function Gallery(props : Readonly<ImageHandleProps>) {
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
  const processedDataList = useMemo(() => props.randomShow ? [...dataList].sort(() => Math.random() - 0.5) : dataList, [dataList, props.randomShow])
  const t = useTranslations()
  const loaderRef = useRef<HTMLDivElement>(null)

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries
    if (entry.isIntersecting && !hasReachedEnd && !isLoading && !isValidating && totalPages > 0 && size < totalPages) {
      setSize((current) => current + 1)
    }
  }, [hasReachedEnd, isLoading, isValidating, setSize, size, totalPages])

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { root: null, rootMargin: '900px 0px', threshold: 0 })
    const currentRef = loaderRef.current
    if (currentRef) observer.observe(currentRef)
    return () => { if (currentRef) observer.unobserve(currentRef) }
  }, [handleObserver])

  return (
    <div className="w-full p-2 space-y-4">
      {isLoading && processedDataList.length === 0 ? <ListSkeleton /> : processedDataList.map((item: ImageType) => (
        <GalleryImage key={item.id} photo={item} configData={[]} />
      ))}
      <div ref={loaderRef} className="flex items-center justify-center my-4 py-6">
        {isValidating && processedDataList.length > 0 && <ReloadIcon className="h-5 w-5 animate-spin opacity-60" />}
        {!isValidating && hasReachedEnd && processedDataList.length > 0 && <div className="text-sm text-gray-500">已加载全部内容</div>}
        {!isLoading && !isValidating && processedDataList.length === 0 && <div className="text-sm text-gray-500">{t('Tips.noImg')}</div>}
      </div>
    </div>
  )
}
