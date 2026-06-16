import 'server-only'

import { Hono } from 'hono'
import { alistUpload, cosUpload, r2Upload, s3Upload } from '~/server/lib/file-upload'

const app = new Hono()

function readableUploadError(e: unknown, storage?: string) {
  const anyError = e as any
  const code = anyError?.Code || anyError?.code || ''
  const message = String(anyError?.message || anyError || '上传失败')

  if (storage === 'cos') {
    if (code === 'InvalidAccessKeyId' || message.includes('InvalidAccessKeyId')) {
      return '腾讯云 COS SecretId 格式或内容无效：请重新保存 COS 配置，SecretId 只填 AKID 开头那一串，不要带 ID / SecretId: / 空格换行。'
    }
    if (code === 'SignatureDoesNotMatch' || message.includes('SignatureDoesNotMatch')) {
      return '腾讯云 COS SecretKey 不匹配：请确认 SecretId 和 SecretKey 是同一组 CAM API 密钥。'
    }
    if (code === 'AccessDenied' || message.includes('AccessDenied')) {
      return '腾讯云 COS 权限不足：需要当前 Bucket 的 PutObject / GetObject / GetBucket 权限。'
    }
    if (code === 'NoSuchBucket' || message.includes('NoSuchBucket')) {
      return '腾讯云 COS Bucket 不存在：Bucket 要填完整桶名，例如 xxx-1250000000。'
    }
  }

  return message
}

app.post('/upload', async (c) => {
  let storage = ''
  try {
    const formData = await c.req.formData()

    const file = formData.get('file')
    storage = String(formData.get('storage') || '')
    const type = formData.get('type')
    const mountPath = formData.get('mountPath') || ''

    if (!file) {
      return c.json({ code: 400, message: '没有收到上传文件' }, 400)
    }

    let result = ''
    switch (storage) {
      case 's3':
        result = await s3Upload(file, type)
        break
      case 'r2':
        result = await r2Upload(file, type)
        break
      case 'cos':
        result = await cosUpload(file, type)
        break
      case 'alist':
        result = await alistUpload(file, type, mountPath)
        break
      default:
        return c.json({ code: 400, message: `不支持的存储类型：${storage || '空'}` }, 400)
    }

    return c.json({ code: 200, data: result, message: '上传成功' })
  } catch (e) {
    console.error(e)
    return c.json({
      code: 500,
      message: readableUploadError(e, storage),
      error: (e as any)?.Code || (e as any)?.code || 'UPLOAD_FAILED',
    }, 500)
  }
})

export default app
