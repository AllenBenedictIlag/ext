// D:\Projects\sidebar\src\components\sidebar\site-header.tsx
import { GlobalQuickFilter } from "@/components/shared/global-quick-filter"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import * as React from "react"
import { usePathname } from "next/navigation"
import { ModeToggle } from "../ui/theme-button"
import { SECTIONS_ADMIN, SECTIONS_SUPERADMIN } from "@/lib/modules"

type NavItem = { title: string; url: string }

const NAV_ITEMS: NavItem[] = [...SECTIONS_ADMIN, ...SECTIONS_SUPERADMIN].flatMap(
  (section) => section.items
)

const ROOT_MAP: Record<string, string> = {
  "/admin": "Admin",
  "/superadmin": "Super Admin",
}

function toTitle(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function resolveTitle(pathname: string): string {
  if (!pathname) return "Documents"

  // 1) Exact or prefix match against known nav items; prefer the longest match
  const match = NAV_ITEMS
    .filter(({ url }) => pathname === url || pathname.startsWith(url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0]
  if (match) return match.title

  // 2) Section root fallback
  for (const [prefix, label] of Object.entries(ROOT_MAP)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return label
  }

  // 3) Derive from the last segment, else final fallback
  const last = pathname.split("?")[0].split("#")[0].split("/").filter(Boolean).pop()
  return last ? toTitle(last) : "Documents"
}

export function SiteHeader() {
  const pathname = usePathname()
  const title = React.useMemo(() => resolveTitle(pathname), [pathname])
  const hideQuickFilter = React.useMemo(() => {
    if (!pathname) return false
    return pathname.startsWith("/admin/settings") 
    || pathname.startsWith("/admin/questions") 
    || pathname.startsWith("/superadmin/settings") 
    || pathname.startsWith("/superadmin/audit-log")  
    || pathname.startsWith("/superadmin/users") 

  }, [pathname])

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b bg-background transition-[width,height] ease-linear md:top-2 md:before:absolute md:before:left-0 md:before:right-0 md:before:top-[-0.5rem] md:before:h-2 md:before:bg-background md:before:content-[''] md:before:pointer-events-none">
      <div className="flex h-(--header-height) w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="min-w-0 flex-1 truncate text-base font-medium">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">
          {!hideQuickFilter && (
            <GlobalQuickFilter className="!mt-0 !w-auto !border-none !px-0 !py-0 !bg-transparent supports-[backdrop-filter]:!bg-transparent !shadow-none flex-nowrap items-center gap-2" />
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
