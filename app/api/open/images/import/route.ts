import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_SECRET } from '~/server/auth-secret'

import { batchImportImages } from '~/server/db/operate/images'


export async function POST(req: Request) {
  try {
    // 验证用户是否登录
    const token = await getToken({ req, secret: AUTH_SECRET })
    if (!token) {
      return NextResponse.json({ code: 401, message: '未授权，请登录' }, { status: 401 })
    }

    const body = await req.json()
    const { images, album } = body
    
    if (!album) {
      return NextResponse.json({ code: 400, message: '相册不能为空' }, { status: 400 })
    }
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ code: 400, message: '图片不能为空' }, { status: 400 })
    }
    
    // 导入图片
    const result = await batchImportImages(images, album)
    
    return NextResponse.json({ 
      code: 200, 
      message: 'Success', 
      data: result.created,
      stats: result
    })
  } catch (error) {
    console.error('导入图片失败', error)
    return NextResponse.json({ code: 500, message: '服务器错误' }, { status: 500 })
  }
} 

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
