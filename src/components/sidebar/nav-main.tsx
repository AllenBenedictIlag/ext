// components/nav-main.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { NavSection } from "@/lib/modules"
import { ICONS } from "@/lib/modules"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type Props = {
  sections: NavSection[]
  className?: string
}

export function NavMain({ sections, className }: Props) {
  const pathname = usePathname()

  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.label} className={className}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {section.items.map((item) => {
                const isActive =
                  pathname === item.url ||
                  (item.url !== "/" && pathname?.startsWith(item.url))

                const Icon = item.icon ? ICONS[item.icon] : undefined

                return (
                  <SidebarMenuItem key={`${section.label}-${item.title}`}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      className={
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/90 min-w-8 duration-200"
                          : ""
                      }
                    >
                      <Link href={item.url} aria-current={isActive ? "page" : undefined}>
                        {Icon ? <Icon /> : null}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
