'use client'

import type { HandleProps, ImageHandleProps } from '~/types/props'
import { useSwrPageTotalHook } from '~/hooks/use-swr-page-total-hook'
import useSWRInfinite from 'swr/infinite'
import { useSwrHydrated } from '~/hooks/use-swr-hydrated'
import { useTranslations } from 'next-intl'
import { MasonryPhotoAlbum, RenderImageContext, RenderImageProps } from 'react-photo-album'
import type { ImageType } from '~/types'
import { ReloadIcon } from '@radix-ui/react-icons'
import React, { useEffect, useRef, useCallback, useMemo } from 'react'
import BlurImage from '~/components/album/blur-image'
import { SparklesIcon } from '~/components/icons/sparkles'
import { UndoIcon } from '~/components/icons/undo'
import { useRouter } from 'next-nprogress-bar'

function renderNextImage(
  _: RenderImageProps,
  { photo }: RenderImageContext,
  dataList: never[],
) {
  return (
    <BlurImage photo={photo} dataList={dataList} />
  );
}

export default function TagGallery(props : Readonly<ImageHandleProps>) {
  const { data: pageTotal } = useSwrPageTotalHook(props)
  const { data, isLoading, isValidating, size, setSize } = useSWRInfinite((index) => {
      return [`client-${props.args}-${index}-${props.album}`, index]
    },
    ([_, index]) => {
      return props.handle(index + 1, props.album)
    }, {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    })
  const configProps: HandleProps = {
    handle: props.configHandle,
    args: 'system-config',
  }
  const { data: configData } = useSwrHydrated(configProps)
  const totalPages = Number(pageTotal) || 0
  const dataList = useMemo(() => data ? [].concat(...data) : [], [data]);
  const processedDataList = useMemo(() => {
    if (!props.randomShow) return dataList
    return [...dataList].sort(() => Math.random() - 0.5)
  }, [dataList, props.randomShow])
  const t = useTranslations()
  const router = useRouter()
  const loaderRef = useRef<HTMLDivElement>(null)
  
  // 当用户滚动到底部附近时，自动加载更多内容
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    // 当加载指示器可见、不在加载中、还有更多内容可加载时，加载更多
    if (entry.isIntersecting && !isLoading && !isValidating && totalPages > 0 && size < totalPages) {
      setSize(size + 1);
    }
  }, [isLoading, isValidating, setSize, size, totalPages]);
  
  // 设置IntersectionObserver来监视加载指示器元素
  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null, // 使用视口作为根
      rootMargin: '200px', // 当元素接近视口底部200px时触发
      threshold: 0.1, // 当10%的元素可见时触发
    });
    
    const currentRef = loaderRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [handleObserver]);

  const exifIconClass = 'dark:text-gray-50'
  const exifTextClass = 'text-tiny text-sm select-none items-center dark:text-gray-50'

  return (
    <div className="w-full p-2 space-y-4">
      <div className="flex flex-col sm:flex-row w-full p-2 items-start justify-between sm:relative overflow-x-clip">
        <div className="order-3 sm:order-1 flex flex-1 flex-col px-2 sm:sticky top-4 self-start">
        </div>
        <div className="order-2 w-full sm:w-[66.667%] mx-auto">
          <MasonryPhotoAlbum
            columns={(containerWidth) => {
              if (containerWidth < 768) return 2;
              if (containerWidth < 1024) return 3;
              return 4;
            }}
            photos={
              processedDataList?.map((item: ImageType) => ({
                src: item.preview_url || item.url,
                alt: item.detail,
                ...item
              })) || []
            }
            render={{image: (...args) => renderNextImage(...args, processedDataList)}}
          />
        </div>
        <div className="order-1 sm:order-3 flex flex-wrap justify-center space-x-2 sm:space-x-0 sm:flex-col flex-1 px-2 py-1 sm:py-0 sm:space-y-1 text-gray-500 sm:sticky top-2 self-start">
          <div className="flex items-center space-x-1">
            <SparklesIcon className={exifIconClass} size={18} />
            <p className={exifTextClass}>
              {props.album}
            </p>
          </div>
          <div className="flex items-center space-x-1" onClick={() => router.back()}>
            <UndoIcon className={exifIconClass} size={18} />
            <p className={exifTextClass}>
              {t('Button.goBack')}
            </p>
          </div>
        </div>
      </div>
      <div ref={loaderRef} className="flex items-center justify-center my-4 py-4">
        {isValidating && <ReloadIcon className="h-6 w-6 animate-spin" />}
        {!isValidating && totalPages > 0 && size >= totalPages && processedDataList.length > 0 && 
          <div className="text-sm text-gray-500">已加载全部内容</div>
        }
        {!isValidating && processedDataList.length === 0 && 
          <div className="text-sm text-gray-500">{t('Tips.noImg')}</div>
        }
      </div>
    </div>
  )
}