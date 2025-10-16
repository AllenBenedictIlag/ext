// lib/modules.ts
// Single place for: types, icon keys, icon registry, and sections.

import type { ComponentType } from "react";
import {
  IconLayoutDashboard,
  IconMessageDots,
  IconChartLine,
  IconChartBar,
  IconHelpCircle,
  IconClipboardCheck,
  IconCircleCheck,
  IconReceipt2,
  IconSettings,
  IconShieldCheck,
  IconListCheck,
  IconUsers,
  IconHistory,
  IconReportAnalytics,
  IconProgressAlert,
} from "@tabler/icons-react";

export type Role = "admin" | "superadmin";

// 1) Types
export type IconKey =
  | "dashboard"
  | "comments"
  | "analytics"
  | "statistics"
  | "questions"
  | "submissions"
  | "answers"
  | "receipts"
  | "settings"
  | "governance"
  | "reviews"
  | "users"
  | "audit"
  | "datahealth"
  | "anomalities";

export type NavItem = {
  title: string;
  url: string;
  icon?: IconKey;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// 2) Icon registry (string key -> actual component)
export const ICONS: Record<IconKey, ComponentType<any>> = {
  dashboard: IconLayoutDashboard,
  comments: IconMessageDots,
  analytics: IconChartLine,
  statistics: IconChartBar,
  questions: IconHelpCircle,
  submissions: IconClipboardCheck,
  answers: IconCircleCheck,
  receipts: IconReceipt2,
  settings: IconSettings,
  governance: IconShieldCheck,
  reviews: IconListCheck,
  users: IconUsers,
  audit: IconHistory,
  datahealth: IconReportAnalytics,
  anomalities: IconProgressAlert,
};

// 3) Grouped navigation data
export const SECTIONS_ADMIN: NavSection[] = [
  {
    label: "Operate",
    items: [
      { title: "Dashboard", url: "/admin/dashboard", icon: "dashboard" },
      { title: "Comments", url: "/admin/comments", icon: "comments" },
      { title: "Statistics", url: "/admin/statistics", icon: "statistics" },
      { title: "Questions", url: "/admin/questions", icon: "questions" },
    ],
  },
  {
    label: "Drilldowns",
    items: [
      { title: "Submissions", url: "/admin/submissions", icon: "submissions" },
      { title: "Answers", url: "/admin/answers", icon: "answers" },
      { title: "Receipts", url: "/admin/receipts", icon: "receipts" },
    ],
  },
  {
    label: "Others",
    items: [{ title: "Settings", url: "/admin/settings", icon: "settings" }],
  },
];

// --- Super Admin-only sections
export const SECTIONS_SUPERADMIN: NavSection[] = [
  {
    label: "Govern",
    items: [
      { title: "Governance", url: "/superadmin/governance", icon: "governance" },
      { title: "Reviews", url: "/superadmin/reviews", icon: "reviews" },
      { title: "Users", url: "/superadmin/users", icon: "users" },
      { title: "Audit Log", url: "/superadmin/audit-log", icon: "audit" },
    ],
  },
  {
    label: "Data Health",
    items: [
      {
        title: "Data Quality",
        url: "/superadmin/data-quality",
        icon: "datahealth",
      },
      {
        title: "Anomalities",
        url: "/superadmin/anomalities",
        icon: "anomalities",
      },
    ],
  },
  {
    label: "System",
    items: [{ title: "Settings", url: "/superadmin/settings", icon: "settings" }],
  },
];
