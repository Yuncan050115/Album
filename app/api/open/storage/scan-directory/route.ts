import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { AUTH_SECRET } from '~/server/auth-secret'

import { listStorageContents } from '~/server/storage/list-storage-contents'


type FileItem = {
  name?: string
  url?: string
  key?: string
  size?: number
  lastModified?: string | Date
  [key: string]: any
}

const DEFAULT_MAX_DEPTH = 5
const DEFAULT_MAX_FILES = 800
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.svg', '.avif', '.heic']

function normalizePath(path = '') {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function isImageName(name = '') {
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex < 0) return false
  return IMAGE_EXTENSIONS.includes(name.slice(dotIndex).toLowerCase())
}

function withMeta(file: FileItem, directory: string) {
  const name = file.name || file.key?.split('/').pop() || '未命名图片'
  const cleanName = name.replace(/\.[^.]+$/, '')
  const labelSource = normalizePath(directory).split('/').filter(Boolean)
  return {
    ...file,
    name,
    title: cleanName,
    sourceDirectory: normalizePath(directory) || '/',
    labels: labelSource,
    exif: {
      data_time: file.lastModified || null,
      source_directory: normalizePath(directory) || '/',
      source_key: file.key || null,
      auto_matched: true
    },
    matched: {
      title: cleanName,
      labels: labelSource,
      time: file.lastModified || null,
      directory: normalizePath(directory) || '/',
    }
  }
}

export async function POST(req: Request) {
  try {
    const token = await getToken({ req, secret: AUTH_SECRET })
    if (!token) {
      return NextResponse.json({ code: 401, message: '未授权，请登录' }, { status: 401 })
    }

    const body = await req.json()
    const storage = body.storage as string
    const path = body.path || ''
    const startPrefix = normalizePath(body.prefix || '')
    const maxDepth = Math.min(Number(body.maxDepth || DEFAULT_MAX_DEPTH), 10)
    const maxFiles = Math.min(Number(body.maxFiles || DEFAULT_MAX_FILES), 3000)

    if (!storage) {
      return NextResponse.json({ code: 400, message: '存储类型不能为空' }, { status: 400 })
    }

    const visited = new Set<string>()
    const files: FileItem[] = []
    const directories: string[] = []

    async function walk(prefix: string, depth: number) {
      const normalizedPrefix = normalizePath(prefix)
      const visitKey = `${storage}:${path}:${normalizedPrefix}`
      if (visited.has(visitKey) || depth > maxDepth || files.length >= maxFiles) return
      visited.add(visitKey)

      const data = await listStorageContents(storage, path, normalizedPrefix)
      const currentFiles = Array.isArray(data?.files) ? data.files : []
      const currentDirs = Array.isArray(data?.directories) ? data.directories : []

      for (const file of currentFiles) {
        if (files.length >= maxFiles) break
        const name = file.name || file.key || ''
        if (!file.url || !isImageName(name)) continue
        files.push(withMeta(file, normalizedPrefix))
      }

      for (const dir of currentDirs) {
        const normalizedDir = normalizePath(String(dir))
        if (!normalizedDir) continue
        directories.push(normalizedDir)
        await walk(normalizedDir, depth + 1)
        if (files.length >= maxFiles) break
      }
    }

    await walk(startPrefix, 0)

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: {
        root: startPrefix || '/',
        scannedDirectories: Array.from(new Set(directories)),
        files,
        total: files.length,
        limited: files.length >= maxFiles,
        maxDepth,
        maxFiles,
      }
    })
  } catch (error) {
    console.error('扫描目录失败', error)
    return NextResponse.json({
      code: 500,
      message: error instanceof Error ? error.message : '服务器错误'
    }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
