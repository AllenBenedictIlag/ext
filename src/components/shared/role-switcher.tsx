"use client"

import { useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRole, DemoRole } from "@/components/providers/role-provider"

const OPTIONS: { value: DemoRole; label: string }[] = [
  { value: "employee", label: "Employee" },
  { value: "hr", label: "HR" },
  { value: "hr-admin", label: "HR Admin" },
  { value: "super-admin", label: "Super Admin" },
]

export function RoleSwitcher() {
  const { role, setRole } = useRole()
  const currentLabel = useMemo(() => OPTIONS.find((opt) => opt.value === role)?.label, [role])

  return (
    <Select value={role} onValueChange={(value) => setRole(value as DemoRole)}>
      <SelectTrigger aria-label="Select persona" size="sm" className="bg-background/60 backdrop-blur">
        <SelectValue placeholder="Switch persona">{currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

