import AuditLog from "@/components/superadmin/audit-log/audit-log";

export default function AuditLogPage() {
    return (
      <div className="p-6 text-muted-foreground">
        <div className="grid grid-cols-2 gap-4 px-6 md:grid-cols-8">
            <AuditLog/>
        </div>
      </div>
    )
  }