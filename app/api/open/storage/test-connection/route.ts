import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_SECRET } from '~/server/auth-secret'

import { listStorageContents } from '~/server/storage/list-storage-contents'


export async function POST(req: Request) {
  try {
    const token = await getToken({ req, secret: AUTH_SECRET })
    if (!token) {
      return NextResponse.json({ code: 401, message: '未授权，请登录' }, { status: 401 })
    }

    const body = await req.json()
    const { storage, path, prefix } = body

    if (!storage) {
      return NextResponse.json({ code: 400, success: false, message: '存储类型不能为空' }, { status: 400 })
    }

    const data = await listStorageContents(storage, path || '', prefix || '')

    return NextResponse.json({
      code: 200,
      success: true,
      message: 'Success',
      data
    })
  } catch (error) {
    console.error('测试存储连接失败', error)
    return NextResponse.json({
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : '服务器错误'
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
