"use client"

import * as React from "react"

export type DemoRole = "employee" | "hr" | "hr-admin" | "super-admin"

type RoleContextValue = {
  role: DemoRole
  setRole: (next: DemoRole) => void
}

const STORAGE_KEY = "exit-demo:active-role"
const RoleContext = React.createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<DemoRole>(() => {
    if (typeof window === "undefined") return "employee"
    const stored = window.localStorage.getItem(STORAGE_KEY) as DemoRole | null
    return stored ?? "employee"
  })

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, role)
    } catch {
      /* ignore */
    }
  }, [role])

  const value = React.useMemo<RoleContextValue>(() => ({ role, setRole }), [role])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const ctx = React.useContext(RoleContext)
  if (!ctx) throw new Error("useRole must be used within a RoleProvider")
  return ctx
}

