import { AntdRegistry } from '@ant-design/nextjs-registry'
import { AppSidebar } from '~/components/layout/admin/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '~/components/ui/sidebar'
import { AdminBackground } from '~/components/layout/admin/admin-background'

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AdminBackground />
      <AppSidebar />
      <main className="flex min-h-screen w-full flex-1 flex-col p-3 font-sans md:p-5">
        <div className="sticky top-3 z-30 mb-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-background/72 px-3 py-2 shadow-sm backdrop-blur-xl">
          <SidebarTrigger className="cursor-pointer" />
          <div className="min-w-0 select-none">
            <div className="text-sm font-semibold leading-none">后台控制台</div>
            <div className="mt-1 text-xs text-muted-foreground">图片、相册、存储源和站点设置统一管理</div>
          </div>
        </div>
        <AntdRegistry>
          <div className="admin-glass-panel min-h-[calc(100vh-6rem)] w-full rounded-3xl p-4 md:p-6">
            {children}
          </div>
        </AntdRegistry>
      </main>
    </SidebarProvider>
  )
}
