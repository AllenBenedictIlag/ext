// D:\Projects\sidebar\src\components\sidebar\app-sidebar.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import { SECTIONS_ADMIN, SECTIONS_SUPERADMIN } from "@/lib/modules";
import { readCachedUser, writeCachedUser, displayName } from "@/lib/user-cache";


export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();

  // Keep the prop shape NavUser expects
  const [user, setUser] = React.useState<{
    name: string;
    email: string;
    avatar: string;
  }>({
    name: "shadcn",
    email: "m@example.com",
    avatar: "/images/black.png",
  });

  const [sections, setSections] = React.useState(SECTIONS_ADMIN);

  React.useEffect(() => {
    const cached = readCachedUser();
    if (cached) {
      setUser({
        name: displayName(cached),
        email: cached.email,
        avatar: "/images/black.png",
      });
      setSections(cached.role === "SUPER_ADMIN" ? SECTIONS_SUPERADMIN : SECTIONS_ADMIN);
      return;
    }
    
        // 1) Try cached user for instant UI
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        const displayName =
          `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || "User";
        setUser({
          name: displayName,
          email: u.email,
          avatar: "/images/black.png",
        });
        setSections(u.role === "SUPER_ADMIN" ? SECTIONS_SUPERADMIN : SECTIONS_ADMIN);
        return; // done
      }
    } catch {}

    // 2) Fallback: ask the server once
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          const u = j.data;
          const displayName =
            `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email || "User";
          setUser({
            name: displayName,
            email: u.email,
            avatar: "/images/black.png",
          });
          setSections(u.role === "SUPER_ADMIN" ? SECTIONS_SUPERADMIN : SECTIONS_ADMIN);

          
          // ...in the /api/auth/me fallback success:
          writeCachedUser({
            id: u.id,
            firstName: u.first_name ?? "",
            lastName: u.last_name ?? "",
            email: u.email,
            role: u.role,
          });

          // Save a light cache for next renders
          try {
            localStorage.setItem(
              "user",
              JSON.stringify({
                id: u.id,
                firstName: u.first_name ?? "",
                lastName: u.last_name ?? "",
                email: u.email,
                role: u.role,
              })
            );
          } catch {}
        } else if (res.status === 401) {
          router.push(`/auth/admins?reason=unauthenticated&from=${encodeURIComponent(window.location.pathname)}`);
        }
      } catch {
        // ignore; middleware still protects routes
      }
    })();
  }, [router]);

  React.useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "user") {
        const next = readCachedUser();
        if (!next) {
          // user cleared → bounce to sign-in
          router.push("/auth/admins");
        } else {
          setUser({
            name: displayName(next),
            email: next.email,
            avatar: "/images/black.png",
          });
          setSections(next.role === "SUPER_ADMIN" ? SECTIONS_SUPERADMIN : SECTIONS_ADMIN);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Header / Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <a href="#" className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src="/images/black.png"
                  alt=""
                  className="dark:hidden object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <img
                  src="/images/white.png"
                  alt=""
                  className="hidden dark:block object-contain w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"
                />
                <span className="font-semibold text-sm sm:text-base md:text-lg">EMC</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent>
        <NavMain sections={sections} />
      </SidebarContent>

      {/* User footer (uses your existing NavUser) */}
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
