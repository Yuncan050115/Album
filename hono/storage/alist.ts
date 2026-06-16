import 'server-only'
import { fetchConfigsByKeys } from '~/server/db/query/configs'

import { Hono } from 'hono'

const app = new Hono()

function normalizeBaseUrl(url = '') {
  return url.replace(/\/$/, '')
}

async function readAlistConfig() {
  const findConfig = await fetchConfigsByKeys([
    'alist_url',
    'alist_token'
  ])
  const alistToken = findConfig.find((item: any) => item.config_key === 'alist_token')?.config_value || ''
  const alistUrl = findConfig.find((item: any) => item.config_key === 'alist_url')?.config_value || ''
  return { findConfig, alistToken, alistUrl }
}

app.get('/info', async (c) => {
  const data = await fetchConfigsByKeys([
    'alist_url',
    'alist_token'
  ])
  return c.json(data)
})

app.get('/storages', async (c) => {
  const { alistToken, alistUrl } = await readAlistConfig()

  if (!alistUrl || !alistToken) {
    return c.json({ code: 200, message: 'AList / OpenList 未配置', data: { content: [] } })
  }

  const baseUrl = normalizeBaseUrl(alistUrl)

  try {
    const data = await fetch(`${baseUrl}/api/admin/storage/list`, {
      method: 'GET',
      headers: { Authorization: alistToken.toString() },
    }).then(res => res.json())

    const content = Array.isArray(data?.data?.content) ? data.data.content : []
    if (data?.code === 200 && content.length > 0) {
      return c.json(data)
    }
  } catch {
    // 普通 token / OpenList 权限不一定能读 admin/storage/list，继续用 fs/list 兜底。
  }

  try {
    const root = await fetch(`${baseUrl}/api/fs/list`, {
      method: 'POST',
      headers: {
        Authorization: alistToken.toString(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '/' }),
    }).then(res => res.json())

    if (root?.code === 200) {
      return c.json({
        code: 200,
        message: 'Success',
        data: {
          content: [
            { id: 'root', mount_path: '/', name: '/', remark: 'root fallback from fs/list' },
          ],
        },
      })
    }

    return c.json({ code: 200, message: root?.message || 'AList / OpenList 可连接，但根目录不可读', data: { content: [] } })
  } catch (error) {
    return c.json({ code: 500, message: error instanceof Error ? error.message : 'AList / OpenList 挂载目录读取失败', data: { content: [] } })
  }
})

export default app
