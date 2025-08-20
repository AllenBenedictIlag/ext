"use client"

import Image from "next/image"
import * as React from "react"

import {
  IconChartBar,
  IconDashboard,
  IconSettings,
  IconUsers,
  IconMessageQuestion
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/images/black.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
    {
      title: "User Management",
      url: "/users",
      icon: IconUsers,
    },
    {
      title: "Question Management",
      url: "/questions",
      icon: IconMessageQuestion,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
  ],
}


export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#" className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src="/images/coffee-crave.png"
                  alt="EXT logo"
                  className="dark:hidden object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <img
                  src="/images/coffee-crave.png"
                  alt="EXT logo (dark)"
                  className="hidden dark:block object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <span className="font-semibold text-sm sm:text-base md:text-lg"> Coffee Crave </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
