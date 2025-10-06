// src/types/settings.ts

/* ---------- Enums & Types ---------- */
export type ThemeChoice = "LIGHT" | "DARK" | "SYSTEM";
export type DateRangeChoice = "LAST_7" | "LAST_30" | "LAST_90";

export type UserSettings = {
  theme: ThemeChoice;
  defaultDateRange: DateRangeChoice;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: "SYSTEM",
  defaultDateRange: "LAST_30",
};

/* ---------- Profile preview (fake/local only) ---------- */
export type UserProfilePreview = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
};

/** Small sample user object for the UI (no network). */
export const SAMPLE_USER_PROFILE: UserProfilePreview = {
  id: 1,
  firstName: "Ava",
  lastName: "Santos",
  email: "ava.santos@example.com",
  role: "ADMIN",
  status: "ACTIVE",
};
