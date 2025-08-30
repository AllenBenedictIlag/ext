// components/app-sidebar.tsx
"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { SECTIONS_ADMIN, SECTIONS_SUPERADMIN } from "@/lib/modules"   // ✅ import your nav config

type Props = React.ComponentProps<typeof Sidebar> & {
  role: "admin" | "superadmin"
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const user = {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/images/black.jpg",
  }
  
  // Determine sections based on user role SECTIONS_ADMIN || SECTIONS_SUPERADMIN
  const sections = SECTIONS_ADMIN


  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Header / Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#" className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src="/images/cc-bg-white.png"
                  alt="EXT logo"
                  className="dark:hidden object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <img
                  src="/images/white.png"
                  alt="EXT logo (dark)"
                  className="hidden dark:block object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <span className="font-semibold text-sm sm:text-base md:text-lg">Coffee Craves</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main nav content (driven by modules.ts) */}
      <SidebarContent>
        <NavMain sections={sections}/>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
