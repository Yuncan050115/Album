'use client'

import { type LucideIcon } from 'lucide-react'
import { Collapsible } from '~/components/ui/collapsible'
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

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
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
    <SidebarGroup>
      <SidebarGroupLabel className="select-none">菜单</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const active = item.url === '/admin' ? pathname === item.url : pathname.startsWith(item.url)
          return (
            <Collapsible key={item.title} asChild className="group/collapsible">
              <SidebarMenuItem className="select-none">
                <SidebarMenuButton
                  className={buttonClasses}
                  tooltip={item.title}
                  isActive={active}
                  onClick={() => go(item.url)}
                >
                  {item.icon && <item.icon size={18} />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
