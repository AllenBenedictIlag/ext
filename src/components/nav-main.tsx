"use client"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"
import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
  }[]
}) {

  const pathname = usePathname()
  
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url || (item.url !== "/" && pathname?.startsWith(item.url))
            return (
            <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                asChild 
                tooltip={item.title}
                className={
                  isActive? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear" : ""
                }
                >
                  <Link href={item.url} passHref>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
             
            </SidebarMenuItem>
          )})}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

