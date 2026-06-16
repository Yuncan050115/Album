import { NextResponse } from 'next/server'
import { db } from '~/server/lib/db'

type BrowseOrder = 'timeDesc' | 'timeAsc' | 'nameAsc' | 'nameDesc'

const ORDER_BY: Record<BrowseOrder, string> = {
  timeDesc: 'created_at DESC',
  timeAsc: 'created_at ASC',
  nameAsc: 'title ASC',
  nameDesc: 'title DESC',
}

const idsCache = new Map<string, { expires: number, ids: string[] }>()
const TTL = Number(process.env.PREVIEW_IDS_CACHE_TTL_MS || 60_000)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const orderParam = searchParams.get('order') as BrowseOrder | null
    const order: BrowseOrder = orderParam && orderParam in ORDER_BY ? orderParam : 'timeDesc'
    const cached = idsCache.get(order)

    if (cached && cached.expires > Date.now()) {
      return NextResponse.json({ success: true, ids: cached.ids, order, cached: true })
    }

    const publicImages = await db.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id
      FROM "public"."images"
      WHERE del = 0 AND show = 0
      ORDER BY ${ORDER_BY[order]}
    `)

    const ids = publicImages.map((img) => img.id)
    idsCache.set(order, { ids, expires: Date.now() + TTL })

    return NextResponse.json({ success: true, ids, order })
  } catch (error) {
    console.error('获取所有图片ID失败:', error)
    return NextResponse.json({ success: false, message: '获取图片列表失败', ids: [] }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
