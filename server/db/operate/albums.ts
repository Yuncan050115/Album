// 相册表

'use server'

import { db } from '~/server/lib/db'
import type { AlbumType } from '~/types'

/**
 * 新增相册
 * @param album 相册数据
 */
export async function insertAlbums(album: AlbumType) {
  if (!album.sort || album.sort < 0) {
    album.sort = 0
  }
  return await db.albums.create({
    data: {
      name: album.name,
      album_value: album.album_value,
      detail: album.detail,
      sort: album.sort,
      show: album.show,
      license: album.license,
      del: 0,
      image_sorting: album.image_sorting,
      random_show: album.random_show,
    }
  })
}

/**
 * 逻辑删除相册
 * @param id 相册 ID
 */
export async function deleteAlbum(id: string) {
  const album = await db.albums.findUnique({
    where: { id },
    select: { album_value: true },
  })
  if (!album) throw new Error('相册不存在')

  // 先找出只属于当前相册的图片；这些图片随相册删除一起逻辑删除。
  const onlyInThisAlbum = await db.$queryRaw<{ id: string }[]>`
    SELECT image.id
    FROM "public"."images" AS image
    INNER JOIN "public"."images_albums_relation" AS relation
      ON relation."imageId" = image.id
    LEFT JOIN "public"."images_albums_relation" AS other_relation
      ON other_relation."imageId" = image.id AND other_relation.album_value <> ${album.album_value}
    LEFT JOIN "public"."albums" AS other_album
      ON other_album.album_value = other_relation.album_value AND other_album.del = 0
    WHERE image.del = 0
      AND relation.album_value = ${album.album_value}
    GROUP BY image.id
    HAVING COUNT(other_album.id) = 0
  `
  const imageIds = onlyInThisAlbum.map((row) => row.id)

  await db.albums.update({
    where: { id },
    data: { del: 1, updatedAt: new Date() }
  })
  await db.imagesAlbumsRelation.deleteMany({
    where: { album_value: album.album_value }
  })
  if (imageIds.length > 0) {
    await db.imagesAlbumsRelation.deleteMany({
      where: { imageId: { in: imageIds } }
    })
    await db.images.updateMany({
      where: { id: { in: imageIds } },
      data: { del: 1, updatedAt: new Date() }
    })
  }

  return { id, album_value: album.album_value, deletedImages: imageIds.length }
}

/**
 * 更新相册
 * @param album 相册数据
 */
export async function updateAlbum(album: AlbumType) {
  if (!album.sort || album.sort < 0) {
    album.sort = 0
  }
  await db.$transaction(async (tx) => {
    const tagOld = await tx.albums.findFirst({
      where: {
        id: album.id
      }
    })
    if (!tagOld) {
      throw new Error('标签不存在！')
    }
    await tx.albums.update({
      where: {
        id: album.id
      },
      data: {
        name: album.name,
        album_value: album.album_value,
        detail: album.detail,
        sort: album.sort,
        show: album.show,
        license: album.license,
        updatedAt: new Date(),
        image_sorting: album.image_sorting,
        random_show: album.random_show,
      }
    })
    await tx.imagesAlbumsRelation.updateMany({
      where: {
        album_value: tagOld.album_value
      },
      data: {
        album_value: album.album_value
      }
    })
  })
}

/**
 * 更新相册是否显示
 * @param id 相册 ID
 * @param show 显示状态：0=显示，1=隐藏
 */
export async function updateAlbumShow(id: string, show: number) {
  return await db.albums.update({
    where: {
      id: id
    },
    data: {
      show: show,
      updatedAt: new Date()
    }
  })
}
