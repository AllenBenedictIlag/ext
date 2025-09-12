'use client'

import { useEffect } from "react"
import { toast } from "sonner"

export default function SuperdashboardPage() {
  useEffect(() => {
    toast.success("Welcome back, Super Admin! 🚀")
  }, [])

  return (
    <div className="p-6 text-muted-foreground">
      {/* This will just render empty space for now */}
    </div>
  )
}
