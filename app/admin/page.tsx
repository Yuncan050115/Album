import Link from 'next/link'
import { ArrowRight, FolderPlus, Images, Settings, UploadCloud } from 'lucide-react'
import { fetchImagesAnalysis } from '~/server/db/query/images'
import CardList from '~/components/admin/dashboard/card-list'
import type { AnalysisDataProps } from '~/types/props'

const actions = [
  {
    title: '图片资产库',
    detail: '筛选、编辑、批量删除和绑定相册',
    href: '/admin/list',
    icon: Images,
  },
  {
    title: '目录扫描导入',
    detail: '从 COS/R2/S3/AList 扫描图片并自动匹配信息',
    href: '/admin/import',
    icon: FolderPlus,
  },
  {
    title: '手动上传',
    detail: '单图、多图、LivePhoto 手动入库',
    href: '/admin/upload',
    icon: UploadCloud,
  },
  {
    title: '存储配置',
    detail: '统一配置对象存储和 AList',
    href: '/admin/settings/storages',
    icon: Settings,
  },
]

export default async function Admin() {
  const data = await fetchImagesAnalysis() as AnalysisDataProps['data']

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="text-xs text-muted-foreground">Yuncan Album Console</div>
        <h1 className="admin-page-title">后台控制台</h1>
        <p className="text-sm text-muted-foreground">常用管理入口集中在这里，不再让上传、导入、图片维护、存储配置互相打架。</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.href} href={action.href} className="interactive-surface rounded-3xl border bg-background/70 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl border bg-muted/45 p-2"><Icon className="h-5 w-5" /></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-5 font-medium">{action.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.detail}</div>
            </Link>
          )
        })}
      </div>

      <CardList data={data} />
    </div>
  )
}
