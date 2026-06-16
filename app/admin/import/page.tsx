'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  Folder,
  FolderOpen,
  HardDrive,
  ImageIcon,
  Loader2,
  RefreshCw,
  ScanSearch,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react'

import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { cn } from '~/lib/utils'
import type { AlbumType } from '~/types'

type StorageType = 's3' | 'r2' | 'cos' | 'alist'

type FileItem = {
  name: string
  url: string
  key?: string
  size?: number
  lastModified?: string
  title?: string
  sourceDirectory?: string
  labels?: string[]
  matched?: {
    title?: string
    time?: string | null
    directory?: string
    labels?: string[]
  }
  [key: string]: any
}

type DirectoryContents = {
  directories: string[]
  files: FileItem[]
}

type StorageStatus = Record<StorageType, Record<string, any>>

const STORAGE_LABEL: Record<StorageType, string> = {
  s3: 'S3 / OSS',
  r2: 'Cloudflare R2',
  cos: '腾讯云 COS',
  alist: 'AList / OpenList',
}

const DEFAULT_STATUS: StorageStatus = {
  s3: { s3: false },
  r2: { r2: false },
  cos: { cos: false },
  alist: { alist: false },
}

function normalizePath(path = '') {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function formatSize(size?: number) {
  if (!size || size <= 0) return '未知大小'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function inferTitle(file: FileItem) {
  return file.title || file.matched?.title || file.name?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') || '未命名图片'
}

function getAlistMountPath(item: any) {
  return item?.mount_path || item?.mountPath || item?.path || item?.name || ''
}

export default function ImportPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState('source')
  const [albums, setAlbums] = React.useState<AlbumType[]>([])
  const [statusMap, setStatusMap] = React.useState<StorageStatus>(DEFAULT_STATUS)
  const [storage, setStorage] = React.useState<StorageType>('alist')
  const [mountPath, setMountPath] = React.useState('/')
  const [prefix, setPrefix] = React.useState('')
  const [currentPath, setCurrentPath] = React.useState('')
  const [contents, setContents] = React.useState<DirectoryContents>({ directories: [], files: [] })
  const [selected, setSelected] = React.useState<FileItem[]>([])
  const [album, setAlbum] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [scanLoading, setScanLoading] = React.useState(false)
  const [scanMode, setScanMode] = React.useState<'shallow' | 'deep'>('shallow')
  const [maxDepth, setMaxDepth] = React.useState(4)
  const [alistStorages, setAlistStorages] = React.useState<any[]>([])
  const [oneClickLoading, setOneClickLoading] = React.useState(false)

  const configured = Boolean(statusMap[storage]?.[storage]) || (storage === 'alist' && (alistStorages.length > 0 || Boolean(statusMap.alist?.server_url) || Boolean(mountPath.trim())))
  const selectedUrls = React.useMemo(() => new Set(selected.map((item) => item.url)), [selected])

  function switchStorage(next: StorageType) {
    setStorage(next)
    setContents({ directories: [], files: [] })
    setSelected([])
    setCurrentPath('')
    setActiveTab('source')
  }

  React.useEffect(() => {
    fetch('/api/v1/albums/get', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setAlbums(Array.isArray(data) ? data : []))
      .catch(() => toast.error('相册列表读取失败'))
    refreshStatus()
  }, [])

  React.useEffect(() => {
    setContents({ directories: [], files: [] })
    setSelected([])
    setCurrentPath('')
    setActiveTab('source')
    if (storage === 'alist') {
      fetch('/api/v1/storage/alist/storages', { cache: 'no-store' })
        .then((response) => response.json())
        .then((data) => {
          const list = Array.isArray(data?.data?.content) ? data.data.content : Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
          setAlistStorages(list)
          const firstMount = list.map(getAlistMountPath).find(Boolean)
          if (firstMount) setMountPath((current) => current && current !== '/' ? current : firstMount)
        })
        .catch(() => setAlistStorages([]))
    }
  }, [storage])

  async function refreshStatus() {
    try {
      const response = await fetch('/api/open/check-storage-status', { cache: 'no-store' })
      const data = await response.json()
      if (data.code === 200) {
        const nextStatus = { ...DEFAULT_STATUS, ...data.data }
        setStatusMap(nextStatus)
      } else {
        toast.error(data.message || '存储状态读取失败')
      }
    } catch (error) {
      toast.error('存储状态读取失败，请检查登录状态')
    }
  }

  function buildRequestPrefix(nextPath = currentPath) {
    return normalizePath(nextPath || prefix)
  }

  async function browseDirectory(nextPath = buildRequestPrefix()) {
    if (!configured) {
      toast.error(`${STORAGE_LABEL[storage]} 还没有配置，先去“存储配置”填好密钥和桶信息`)
      return
    }
    if (storage === 'alist' && !mountPath.trim()) {
      toast.error('AList 需要填写挂载路径，例如 /photos')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/open/storage/browse-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage,
          path: storage === 'alist' ? mountPath : '',
          prefix: normalizePath(nextPath),
        }),
      })
      const data = await response.json()
      if (data.code !== 200) throw new Error(data.message || '目录读取失败')
      const nextContents = {
        directories: data.data?.directories || [],
        files: (data.data?.files || []).map((file: FileItem) => ({
          ...file,
          title: inferTitle(file),
          sourceDirectory: normalizePath(nextPath) || '/',
          matched: {
            title: inferTitle(file),
            directory: normalizePath(nextPath) || '/',
            time: file.lastModified || null,
            labels: normalizePath(nextPath).split('/').filter(Boolean),
          }
        })),
      }
      setContents(nextContents)
      setCurrentPath(normalizePath(nextPath))
      setSelected([])
      setActiveTab('browse')
      setScanMode('shallow')
      toast.success(`已读取 ${nextContents.directories.length} 个目录、${nextContents.files.length} 张图片`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '目录读取失败')
    } finally {
      setLoading(false)
    }
  }

  async function scanDirectory(autoImport = false) {
    if (!configured) {
      toast.error(`${STORAGE_LABEL[storage]} 还没有配置`)
      return
    }
    if (storage === 'alist' && !mountPath.trim()) {
      toast.error('AList 需要填写挂载路径，例如 /photos')
      return
    }

    if (autoImport && !album) {
      toast.warning('一键导入前先选择目标相册')
      return
    }

    setScanLoading(true)
    if (autoImport) setOneClickLoading(true)
    try {
      const response = await fetch('/api/open/storage/scan-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage,
          path: storage === 'alist' ? mountPath : '',
          prefix: buildRequestPrefix(),
          maxDepth,
          maxFiles: 1200,
        }),
      })
      const data = await response.json()
      if (data.code !== 200) throw new Error(data.message || '扫描失败')
      const files = data.data?.files || []
      setContents({ directories: data.data?.scannedDirectories || [], files })
      setSelected(files)
      setCurrentPath(normalizePath(data.data?.root === '/' ? '' : data.data?.root || buildRequestPrefix()))
      setActiveTab(autoImport ? 'album' : 'browse')
      setScanMode('deep')
      if (autoImport) {
        if (files.length === 0) {
          toast.warning('扫描完成，但没有发现可导入图片')
        } else {
          const importResponse = await fetch('/api/open/images/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: files, album }),
          })
          const importData = await importResponse.json()
          if (importData.code !== 200) throw new Error(importData.message || '导入失败')
          toast.success(`一键完成：扫描 ${files.length} 张，新增 ${importData.stats?.created ?? importData.data ?? 0} 张，绑定 ${importData.stats?.linked ?? 0} 条关系；重复图片已补绑定相册`)
          router.refresh()
        }
      } else {
        toast.success(`扫描完成：自动选中 ${files.length} 张图片${data.data?.limited ? '，已触及数量上限' : ''}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '扫描失败')
    } finally {
      setScanLoading(false)
      if (autoImport) setOneClickLoading(false)
    }
  }

  function enterDirectory(dir: string) {
    browseDirectory(dir)
  }

  function goParent() {
    const parent = currentPath.split('/').filter(Boolean).slice(0, -1).join('/')
    browseDirectory(parent)
  }

  function toggleFile(file: FileItem) {
    setSelected((prev) => {
      if (prev.some((item) => item.url === file.url)) {
        return prev.filter((item) => item.url !== file.url)
      }
      return [...prev, file]
    })
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const map = new Map(prev.map((item) => [item.url, item]))
      for (const file of contents.files) map.set(file.url, file)
      return Array.from(map.values())
    })
  }

  function clearVisible() {
    const visible = new Set(contents.files.map((file) => file.url))
    setSelected((prev) => prev.filter((item) => !visible.has(item.url)))
  }

  async function importImages() {
    if (!album) {
      toast.warning('先选择目标相册')
      return
    }
    if (selected.length === 0) {
      toast.warning('还没有选择图片')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/open/images/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: selected, album }),
      })
      const data = await response.json()
      if (data.code !== 200) throw new Error(data.message || '导入失败')
      toast.success(`导入完成：新增 ${data.stats?.created ?? data.data ?? 0} 张，绑定 ${data.stats?.linked ?? 0} 条关系；重复图片会自动补绑定相册`)
      setSelected([])
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> 新版导入台 · 目录扫描 · 自动信息匹配
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">图片资产导入</h1>
          <p className="mt-1 text-sm text-muted-foreground">先选存储源，再扫描目录，最后批量导入到相册。重复图片会自动跳过，不再乱塞。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshStatus} disabled={loading || scanLoading}>
            <RefreshCw className="mr-2 h-4 w-4" /> 刷新配置
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/settings/storages')}>
            <HardDrive className="mr-2 h-4 w-4" /> 存储配置
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(Object.keys(STORAGE_LABEL) as StorageType[]).map((type) => {
          const ok = Boolean(statusMap[type]?.[type]) || (type === 'alist' && (alistStorages.length > 0 || Boolean(statusMap.alist?.server_url) || Boolean(mountPath.trim())))
          return (
            <button
              key={type}
              type="button"
              onClick={() => switchStorage(type)}
              className={cn(
                'interactive-surface rounded-3xl border bg-background/68 p-4 text-left shadow-sm backdrop-blur-xl',
                storage === type && 'border-primary/70 ring-2 ring-primary/15',
              )}
            >
              <div className="flex items-center justify-between">
                <Database className="h-5 w-5" />
                <Badge variant={ok ? 'default' : 'outline'}>{ok ? '已配置' : '未配置'}</Badge>
              </div>
              <div className="mt-4 font-medium">{STORAGE_LABEL[type]}</div>
              <div className="mt-1 text-xs text-muted-foreground">{type === 'alist' ? '需填写挂载路径' : '读取桶目录和图片对象'}</div>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden rounded-3xl border-border/60 bg-background/72 shadow-sm backdrop-blur-xl">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle>导入流程</CardTitle>
          <CardDescription>支持单层浏览，也支持递归扫描目录；扫描结果会自动生成标题、来源目录、标签和时间线索。</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/60 p-1">
              <TabsTrigger value="source">1. 存储源</TabsTrigger>
              <TabsTrigger value="browse" disabled={contents.files.length === 0 && contents.directories.length === 0}>2. 扫描结果</TabsTrigger>
              <TabsTrigger value="album" disabled={selected.length === 0}>3. 入库</TabsTrigger>
            </TabsList>

            <TabsContent value="source" className="mt-6 space-y-5">
              {!configured && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-200">
                  当前 {STORAGE_LABEL[storage]} 未配置或状态未刷新。AList/OpenList 若已配置，请选择/填写挂载路径；没有拿到挂载列表时也可以手动填 / 或 /photos 后扫描。
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>当前导入来源</Label>
                  <Select value={storage} onValueChange={(value) => switchStorage(value as StorageType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STORAGE_LABEL) as StorageType[]).map((type) => (
                        <SelectItem key={type} value={type}>{STORAGE_LABEL[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">这里决定“浏览 / 扫描 / 一键导入”真正使用哪种存储。AList/OpenList 默认优先。</p>
                </div>

                <div className="space-y-2">
                  <Label>目标相册</Label>
                  <Select value={album} onValueChange={setAlbum}>
                    <SelectTrigger><SelectValue placeholder="选择导入到哪个相册" /></SelectTrigger>
                    <SelectContent>
                      {albums.map((item) => <SelectItem key={item.id} value={item.album_value}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">选好后可以直接“一键扫描并导入”。</p>
                </div>

                <div className="space-y-2">
                  <Label>起始目录 / 前缀</Label>
                  <Input value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="例如 photos/2026 或留空从根目录开始" />
                  <p className="text-xs text-muted-foreground">COS/R2/S3 填对象前缀；AList 填挂载路径下的子目录。</p>
                </div>

                {storage === 'alist' && (
                  <div className="space-y-2">
                    <Label>AList 挂载路径</Label>
                    {alistStorages.length > 0 ? (
                      <Select value={mountPath} onValueChange={setMountPath}>
                        <SelectTrigger><SelectValue placeholder="选择 AList 存储挂载" /></SelectTrigger>
                        <SelectContent>
                          {alistStorages.map((item: any) => {
                            const value = getAlistMountPath(item)
                            return value ? <SelectItem key={value} value={value}>{value}</SelectItem> : null
                          })}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={mountPath} onChange={(event) => setMountPath(event.target.value)} placeholder="例如 /photos" />
                    )}
                    <p className="text-xs text-muted-foreground">这是 AList 的挂载根目录；下面的“起始目录”是挂载内子目录。选好后可直接“一键扫描并导入”。</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>递归深度</Label>
                  <Select value={String(maxDepth)} onValueChange={(value) => setMaxDepth(Number(value))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 8, 10].map((depth) => <SelectItem key={depth} value={String(depth)}>{depth} 层</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">目录很多时不要一口气扫太深，避免对象存储 API 慢。</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => browseDirectory(buildRequestPrefix())} disabled={loading || scanLoading || !configured}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
                  浏览当前目录
                </Button>
                <Button variant="secondary" onClick={() => scanDirectory(false)} disabled={loading || scanLoading || !configured}>
                  {scanLoading && !oneClickLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
                  扫描目录并自动选择
                </Button>
                <Button onClick={() => scanDirectory(true)} disabled={loading || scanLoading || oneClickLoading || !configured || !album}>
                  {oneClickLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  一键扫描并导入
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="browse" className="mt-6 space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl border bg-muted/20 p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FolderOpen className="h-4 w-4" /> {currentPath || '/'}
                    <Badge variant="outline">{scanMode === 'deep' ? '递归扫描' : '单层浏览'}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">目录 {contents.directories.length} 个 · 图片 {contents.files.length} 张 · 已选 {selected.length} 张</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={goParent} disabled={!currentPath || loading}>上级</Button>
                  <Button variant="outline" size="sm" onClick={selectAllVisible}>全选当前图片</Button>
                  <Button variant="outline" size="sm" onClick={clearVisible}>取消当前选择</Button>
                  <Button size="sm" onClick={() => setActiveTab('album')} disabled={selected.length === 0}>下一步 <ArrowRight className="ml-1 h-4 w-4" /></Button>
                </div>
              </div>

              {contents.directories.length > 0 && scanMode === 'shallow' && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">目录</div>
                  <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
                    {contents.directories.map((dir) => (
                      <button key={dir} type="button" onClick={() => enterDirectory(dir)} className="interactive-surface flex items-center gap-2 rounded-2xl border bg-background/65 p-3 text-left text-sm shadow-sm">
                        <Folder className="h-4 w-4 text-amber-500" />
                        <span className="truncate">{dir.split('/').filter(Boolean).pop() || dir}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">图片</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wand2 className="h-3.5 w-3.5" /> 标题、标签、来源目录已自动匹配</div>
                </div>
                <ScrollArea className="h-[520px] rounded-3xl border bg-background/45 p-3">
                  {contents.files.length === 0 ? (
                    <div className="flex h-80 flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="mb-3 h-10 w-10" /> 当前目录下没有可导入图片
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                      {contents.files.map((file) => {
                        const picked = selectedUrls.has(file.url)
                        return (
                          <button
                            key={file.url}
                            type="button"
                            onClick={() => toggleFile(file)}
                            className={cn(
                              'interactive-surface group overflow-hidden rounded-2xl border bg-background/70 text-left shadow-sm',
                              picked && 'border-primary ring-2 ring-primary/20',
                            )}
                          >
                            <div className="relative aspect-square bg-muted">
                              <img src={file.url} alt={file.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                              <div className={cn("absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border bg-background/85 shadow backdrop-blur", picked && "bg-primary text-primary-foreground")}>
                                {picked && <Check className="h-3.5 w-3.5" />}
                              </div>
                            </div>
                            <div className="space-y-1 p-2">
                              <div className="truncate text-xs font-medium">{inferTitle(file)}</div>
                              <div className="truncate text-[11px] text-muted-foreground">{file.sourceDirectory || file.matched?.directory || '/'}</div>
                              <div className="text-[11px] text-muted-foreground">{formatSize(file.size)}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="album" className="mt-6 space-y-5">
              <div className="grid gap-4 md:grid-cols-[1fr_1.3fr]">
                <Card className="rounded-3xl bg-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base">目标相册</CardTitle>
                    <CardDescription>选择导入后要绑定的相册。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={album} onValueChange={setAlbum}>
                      <SelectTrigger><SelectValue placeholder="选择相册" /></SelectTrigger>
                      <SelectContent>
                        {albums.map((item) => <SelectItem key={item.id} value={item.album_value}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={importImages} disabled={loading || !album || selected.length === 0}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                      导入 {selected.length} 张图片
                    </Button>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl bg-muted/20">
                  <CardHeader>
                    <CardTitle className="text-base">自动匹配预览</CardTitle>
                    <CardDescription>系统会根据文件名、目录、最后修改时间写入标题、标签和基础 exif 字段。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[260px] pr-3">
                      <div className="space-y-2">
                        {selected.slice(0, 20).map((file) => (
                          <div key={file.url} className="flex items-center gap-3 rounded-2xl border bg-background/55 p-2">
                            <img src={file.url} alt={file.name} loading="lazy" decoding="async" className="h-12 w-12 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{inferTitle(file)}</div>
                              <div className="truncate text-xs text-muted-foreground">{file.matched?.directory || file.sourceDirectory || '/'}</div>
                            </div>
                            <Badge variant="outline">auto</Badge>
                          </div>
                        ))}
                        {selected.length > 20 && <div className="text-center text-xs text-muted-foreground">还有 {selected.length - 20} 张未显示</div>}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab('browse')}><ArrowLeft className="mr-2 h-4 w-4" /> 返回扫描结果</Button>
                <Button variant="outline" onClick={() => setActiveTab('source')}><Search className="mr-2 h-4 w-4" /> 重新扫描</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {(loading || scanLoading) && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border bg-background/90 px-4 py-3 text-sm shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-4 w-4 animate-spin" /> {scanLoading ? '正在扫描目录...' : '正在处理...'}
        </div>
      )}

      {!configured && (
        <div className="flex items-start gap-2 rounded-2xl border bg-muted/35 p-4 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>提示：导入工具只读取已经配置好的存储源；密钥不会在页面里反复填写，避免后台更乱。</div>
        </div>
      )}
    </div>
  )
}
