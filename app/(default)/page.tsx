import type { ImageHandleProps } from '~/types/props'
import AlbumGallery from '~/components/album/album-gallery'
import 'react-photo-album/masonry.css'

export default function Home() {
  const noopData = async () => {
    'use server'
    return []
  }
  const noopTotal = async () => {
    'use server'
    return 9999
  }
  const noopConfig = async () => {
    'use server'
    return []
  }

  const props: ImageHandleProps = {
    // 首页图片现在统一走 /api/v1/images/client-list，避免首页服务端先查配置导致白屏。
    handle: noopData,
    args: 'getImages-client',
    album: '/',
    totalHandle: noopTotal,
    configHandle: noopConfig,
    randomShow: false,
  }

  return <AlbumGallery {...props} />
}
