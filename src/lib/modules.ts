// lib/modules.ts
// Single place for: types, icon keys, icon registry, and sections.

import {
    IconChartBar,
    IconDashboard,
    IconSettings,
    IconUsers,
    IconMessageQuestion,
    IconDatabase,
    IconFileWord,
    IconReport,
    IconCalendarEvent,
    IconLock,
  } from "@tabler/icons-react"
  
  export type Role = "admin" | "superadmin"

  // 1) Types
  export type IconKey =
    | "dashboard"
    | "calendar"
    | "chart"
    | "users"
    | "question"
    | "settings"
    | "database"
    | "word"
    | "report"
  
  export type NavItem = {
    title: string
    url: string
    icon?: IconKey
  }
  
  export type NavSection = {
    label: string
    items: NavItem[]
  }
  
  // 2) Icon registry (string key -> actual component)
  export const ICONS: Record<IconKey, React.ComponentType<any>> = {
    dashboard: IconDashboard,
    calendar: IconCalendarEvent,
    chart: IconChartBar,
    users: IconUsers,
    question: IconMessageQuestion,
    settings: IconSettings,
    database: IconDatabase,
    word: IconFileWord,
    report: IconReport,
  }
  
  // 3) Your grouped navigation data
  export const SECTIONS_ADMIN: NavSection[] = [
    {
      label: "Admin",
      items: [
        { title: "Dashboard",  url: "/admin/dashboard",  icon: "dashboard" },
        { title: "Schedules",  url: "/admin/schedules",  icon: "calendar" },
        { title: "Analytics",  url: "/admin/analytics",  icon: "chart" },
      ],
    },
    {
      label: "Management",
      items: [
        { title: "Questions",  url: "/admin/questions",  icon: "question" },
        { title: "Employees",  url: "/admin/employees",  icon: "users" },
      ],
    },
    {
      label: "Others",
      items: [
        { title: "Settings",   url: "/admin/settings",   icon: "settings" },
      ],
    },
  ]

  // --- Super Admin-only sections
export const SECTIONS_SUPERADMIN: NavSection[] = [
    {
      label: "Super Admin",
      items: [
        { title: "Super Dashboard",  url: "/superadmin/superdashboard", icon: "dashboard" },
        { title: "Admins",           url: "/superadmin/admins",         icon: "users" },
      ],
    },
    {
      label: "Controls",
      items: [
        { title: "Global Settings",  url: "/superadmin/globals",        icon: "database" },
        { title: "Form Templates",   url: "/superadmin/template",       icon: "word" },
      ],
    },
    {
      label: "Maintenance",
      items: [
        { title: "Backup & Restore", url: "/superadmin/backups",        icon: "report" },
      ],
    },
  ]
