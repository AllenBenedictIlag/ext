// src/lib/user-cache.ts
export type CachedUser = {
    id: number
    firstName: string
    lastName: string
    email: string
    role: "ADMIN" | "SUPER_ADMIN"
  }
  
  const KEY = "user"
  
  /** Save a lightweight user object for instant UI (sidebar/user card). */
  export function writeCachedUser(u: CachedUser) {
    try {
      localStorage.setItem(KEY, JSON.stringify(u))
    } catch {}
  }
  
  /** Read cached user or null if missing/invalid. */
  export function readCachedUser(): CachedUser | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const u = JSON.parse(raw)
      if (!u || typeof u !== "object") return null
      if (!u.email || !u.role) return null
      return u as CachedUser
    } catch {
      return null
    }
  }
  
  /** Remove cached user (used on logout). */
  export function clearCachedUser() {
    try {
      localStorage.removeItem(KEY)
    } catch {}
  }
  
  /** Nice display name fallback. */
  export function displayName(u: { firstName?: string; lastName?: string; email?: string }) {
    const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
    return name || u.email || "User"
  }
  