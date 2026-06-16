'use client'

import { type LucideIcon } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '~/components/ui/sidebar'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next-nprogress-bar'

export function NavProjects({
  projects,
}: {
  projects: {
    title: string
    items?: {
      name: string
      url: string
      icon: LucideIcon
    }[]
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const buttonClasses = 'cursor-pointer rounded-xl transition-all duration-200 ease-out active:scale-[0.98] data-[active=true]:shadow-sm'

  const go = (url: string) => {
    if (pathname === url) return
    setOpenMobile(false)
    router.push(url)
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="select-none">{projects.title}</SidebarGroupLabel>
      <SidebarMenu className="select-none">
        {projects?.items?.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              className={buttonClasses}
              isActive={pathname.startsWith(item.url)}
              onClick={() => go(item.url)}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
