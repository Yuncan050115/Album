// 图片表

'use server'

import { randomUUID } from 'node:crypto'
import { db } from '~/server/lib/db'
import type { ImageType } from '~/types'

/**
 * 新增图片
 * @param image 图片数据
 */
export async function insertImage(image: ImageType) {
  if (!image.sort || image.sort < 0) {
    image.sort = 0
  }
  await db.$transaction(async (tx) => {
    const resultRow = await tx.images.create({
      data: {
        url: image.url,
        title: image.title,
        preview_url: image.preview_url,
        video_url: image.video_url,
        exif: image.exif,
        labels: image.labels,
        width: image.width,
        height: image.height,
        detail: image.detail,
        lat: String(image.lat),
        lon: String(image.lon),
        type: image.type,
        show: 1,
        sort: image.sort,
        del: 0,
      }
    })

    if (resultRow) {
      await tx.imagesAlbumsRelation.create({
        data: {
          imageId: resultRow.id,
          album_value: image.album
        }
      })
    } else {
      throw new Error('事务处理失败！')
    }
  })
}


/**
 * 批量导入图片
 * @param images 图片数据数组
 * @param album 相册值
 * @returns 导入成功的图片数量
 */
function cleanImageTitle(name = '') {
  return String(name)
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim() || '未命名图片'
}

function parseDateFromName(name = '') {
  const compact = name.match(/(20\d{2})(\d{2})(\d{2})[_-]?(\d{2})?(\d{2})?(\d{2})?/)
  if (compact) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = compact
    return `${y}:${m}:${d} ${hh}:${mm}:${ss}`
  }
  const dashed = name.match(/(20\d{2})[-.](\d{1,2})[-.](\d{1,2})[ T_-]?(\d{1,2})?[:.-]?(\d{1,2})?[:.-]?(\d{1,2})?/)
  if (dashed) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = dashed
    return `${y}:${m.padStart(2, '0')}:${d.padStart(2, '0')} ${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}`
  }
  return null
}

function normalizeLabels(input: any) {
  if (Array.isArray(input)) return input.filter(Boolean)
  if (typeof input === 'string') return input.split(/[，,\s/]+/).filter(Boolean)
  return []
}


function normalizeExifDateValue(value: any) {
  if (!value) return null
  if (typeof value === 'string') return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function buildAutoExif(image: any, title: string) {
  const existingExif = image.exif && typeof image.exif === 'object' ? image.exif : {}
  const nameDate = parseDateFromName(image.name || image.key || image.url || '')
  let modifiedDate: string | null = null
  if (image.lastModified) {
    const date = new Date(image.lastModified)
    if (!Number.isNaN(date.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0')
      modifiedDate = `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }
  }

  const matchedDate = normalizeExifDateValue(image.matched?.time)

  return {
    ...existingExif,
    data_time: existingExif.data_time || matchedDate || nameDate || modifiedDate || null,
    source_directory: existingExif.source_directory || image.sourceDirectory || image.matched?.directory || '',
    source_key: existingExif.source_key || image.key || '',
    source_size: existingExif.source_size || image.size || null,
    auto_title: title,
    auto_matched: true,
  }
}

export async function batchImportImages(images: any[], album: string) {
  const uniqueImages = Array.from(
    new Map(
      images
        .filter((image) => image?.url)
        .map((image) => [String(image.url).trim(), image])
    ).values()
  )

  if (!uniqueImages.length) {
    return { created: 0, linked: 0, skipped: 0, total: 0 }
  }

  const urls = uniqueImages.map((image) => String(image.url).trim())
  const existingRows = await db.images.findMany({
    where: { url: { in: urls }, del: 0 },
    select: { id: true, url: true },
  })
  const existingByUrl = new Map(existingRows.map((row) => [String(row.url), row.id]))

  const newRows = uniqueImages
    .filter((image) => !existingByUrl.has(String(image.url).trim()))
    .map((image) => {
      const url = String(image.url).trim()
      const title = image.title || image.matched?.title || cleanImageTitle(image.name || image.key || image.url)
      const labels = normalizeLabels(image.labels?.length ? image.labels : image.matched?.labels)
      const id = randomUUID().replace(/-/g, '')
      existingByUrl.set(url, id)
      return {
        id,
        url,
        title,
        preview_url: image.preview_url || image.previewUrl || image.thumb_url || image.thumbnail || url,
        video_url: image.video_url || '',
        exif: buildAutoExif(image, title),
        labels,
        width: Number(image.width) > 0 ? Number(image.width) : 1600,
        height: Number(image.height) > 0 ? Number(image.height) : 1000,
        detail: image.detail || image.sourceDirectory || image.matched?.directory || '',
        lat: image.lat ? String(image.lat) : '',
        lon: image.lon ? String(image.lon) : '',
        type: Number(image.type) || 1,
        show: 0,
        show_on_mainpage: 0,
        sort: Number(image.sort) || 0,
        del: 0,
      }
    })

  const relationRows = uniqueImages
    .map((image) => {
      const imageId = existingByUrl.get(String(image.url).trim())
      return imageId ? { imageId, album_value: album } : null
    })
    .filter(Boolean) as { imageId: string, album_value: string }[]

  const CHUNK_SIZE = 120
  let created = 0
  let linked = 0

  for (let i = 0; i < newRows.length; i += CHUNK_SIZE) {
    const chunk = newRows.slice(i, i + CHUNK_SIZE)
    if (!chunk.length) continue
    const result = await db.images.createMany({ data: chunk, skipDuplicates: true })
    created += result.count
  }

  for (let i = 0; i < relationRows.length; i += CHUNK_SIZE) {
    const chunk = relationRows.slice(i, i + CHUNK_SIZE)
    if (!chunk.length) continue
    const result = await db.imagesAlbumsRelation.createMany({ data: chunk, skipDuplicates: true })
    linked += result.count
  }

  return {
    created,
    linked,
    skipped: uniqueImages.length - created,
    total: uniqueImages.length,
  }
}

/**
 * 逻辑删除图片
 * @param id 图片 ID
 */
export async function deleteImage(id: string) {
  await db.$transaction(async (tx) => {
    await tx.imagesAlbumsRelation.deleteMany({
      where: {
        imageId: id
      }
    })

    await tx.images.update({
      where: {
        id: id
      },
      data: {
        del: 1,
        updatedAt: new Date(),
      }
    })
  })
}

/**
 * 批量逻辑删除图片
 * @param ids 图片 ID 数组
 */
export async function deleteBatchImage(ids: string[]) {
  await db.$transaction(async (tx) => {
    await tx.imagesAlbumsRelation.deleteMany({
      where: {
        imageId: {
          in: ids
        }
      }
    })
    await tx.images.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data: {
        del: 1,
        updatedAt: new Date(),
      },
    })
  })
}

/**
 * 清理没有绑定到任何有效相册的孤儿图片。
 * 包括：没有关联记录，或只绑定到了已删除相册的图片。
 */
export async function deleteOrphanImages() {
  const orphanRows = await db.$queryRaw<{ id: string }[]>`
    SELECT image.id
    FROM "public"."images" AS image
    LEFT JOIN "public"."images_albums_relation" AS relation
      ON relation."imageId" = image.id
    LEFT JOIN "public"."albums" AS album
      ON album.album_value = relation.album_value AND album.del = 0
    WHERE image.del = 0
    GROUP BY image.id
    HAVING COUNT(album.id) = 0
  `
  const ids = orphanRows.map((row) => row.id)
  if (!ids.length) return { deleted: 0 }

  const CHUNK_SIZE = 200
  let deleted = 0
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE)
    await db.imagesAlbumsRelation.deleteMany({ where: { imageId: { in: chunk } } })
    const result = await db.images.updateMany({
      where: { id: { in: chunk } },
      data: { del: 1, updatedAt: new Date() },
    })
    deleted += result.count
  }
  return { deleted }
}

/**
 * 更新图片
 * @param image 图片数据
 */
export async function updateImage(image: ImageType) {
  if (!image.sort || image.sort < 0) {
    image.sort = 0
  }
  await db.$transaction(async (tx) => {
    await tx.images.update({
      where: {
        id: image.id
      },
      data: {
        url: image.url,
        title: image.title,
        preview_url: image.preview_url,
        video_url: image.video_url,
        exif: image.exif,
        labels: image.labels,
        detail: image.detail,
        sort: image.sort,
        show: image.show,
        show_on_mainpage: image.show_on_mainpage,
        width: image.width,
        height: image.height,
        lat: image.lat,
        lon: image.lon,
        updatedAt: new Date(),
      }
    })
  })
}

/**
 * 更新图片的显示状态
 * @param id 图片 ID
 * @param show 显示状态：0=显示，1=隐藏
 */
export async function updateImageShow(id: string, show: number) {
  return await db.images.update({
    where: {
      id: id
    },
    data: {
      show: show,
      updatedAt: new Date()
    }
  })
}

/**
 * 更新图片的相册
 * @param imageId 图片 ID
 * @param albumId 相册 ID
 */
export async function updateImageAlbum(imageId: string, albumId: string) {
  await db.$transaction(async (tx) => {
    const resultRow = await tx.albums.findUnique({
      where: {
        id: albumId
      }
    })
    if (!resultRow) {
      throw new Error('相册不存在！')
    }
    await tx.imagesAlbumsRelation.deleteMany({
      where: {
        imageId: imageId,
      }
    })
    await tx.imagesAlbumsRelation.create({
      data: {
        imageId: imageId,
        album_value: resultRow.album_value
      }
    })
  })
}

/**
 * 批量更新图片的首页显示状态
 * @param imageIds 图片ID数组
 * @param showOnMainpage 是否显示在首页 0显示，1不显示
 */
export async function updateBatchImagesMainpage(imageIds: string[], showOnMainpage: number) {
  if (!imageIds || imageIds.length === 0) {
    throw new Error('图片ID不能为空！')
  }
  
  await db.images.updateMany({
    where: {
      id: {
        in: imageIds
      }
    },
    data: {
      show_on_mainpage: showOnMainpage
    }
  })
}
