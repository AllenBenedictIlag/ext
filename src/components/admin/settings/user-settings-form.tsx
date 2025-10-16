// src/components/admin/settings/user-settings-form.tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  ThemeChoice,
  DateRangeChoice,
  UserSettings,
  UserProfilePreview,
} from "@/types/settings";
import { DEFAULT_USER_SETTINGS } from "@/types/settings";
import { writeCachedUser } from "@/lib/user-cache";
import { persistDefaultDateRange } from "@/lib/dashboard-filters";

/* ---------- Helpers ---------- */

const themeChoiceToNextThemes = (t: ThemeChoice): "light" | "dark" | "system" =>
  t === "LIGHT" ? "light" : t === "DARK" ? "dark" : "system";

/* ---------- Zod Schemas (UI-only) ---------- */

const ProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const PasswordSchema = z
  .object({
    current: z.string().min(1, "Current password is required"),
    next: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string().min(1, "Please confirm your new password"),
  })
  .refine((v) => v.next === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

const PreferencesSchema = z.object({
  theme: z.union([z.literal("LIGHT"), z.literal("DARK"), z.literal("SYSTEM")]),
  defaultDateRange: z.union([
    z.literal("LAST_7"),
    z.literal("LAST_30"),
    z.literal("LAST_90"),
    z.literal("LAST_365"),
  ]),
});

type ProfileValues = z.infer<typeof ProfileSchema>;
type PasswordValues = z.infer<typeof PasswordSchema>;
type PreferencesValues = z.infer<typeof PreferencesSchema>;

/* ---------- Component ---------- */

export default function UserSettingsForm() {
  const { setTheme, theme: activeTheme } = useTheme();

  const [profile, setProfile] = React.useState<UserProfilePreview | null>(null);
  const [preferences, setPreferences] = React.useState<UserSettings | null>(null);
  const [initializing, setInitializing] = React.useState(true);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isSubmitting: profileBusy },
    reset: resetProfile,
  } = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: pwErrors, isSubmitting: pwBusy },
    reset: resetPassword,
  } = useForm<PasswordValues>({
    resolver: zodResolver(PasswordSchema),
    defaultValues: {
      current: "",
      next: "",
      confirm: "",
    },
  });

  // Preferences form
  const {
    control: controlPrefs,
    handleSubmit: handleSubmitPrefs,
    formState: { errors: prefsErrors, isSubmitting: prefsBusy },
    watch: watchPrefs,
    reset: resetPrefs,
  } = useForm<PreferencesValues>({
    resolver: zodResolver(PreferencesSchema),
    defaultValues: {
      theme: DEFAULT_USER_SETTINGS.theme,
      defaultDateRange: DEFAULT_USER_SETTINGS.defaultDateRange,
    },
  });

  // Apply theme immediately on change (optimistic preview)
  const themeValue = watchPrefs("theme");
  React.useEffect(() => {
    if (!themeValue) return;
    if (initializing) return;
    const next = themeChoiceToNextThemes(themeValue);
    const current = activeTheme ?? "system";
    if (next === current) return;
    setTheme(next);
  }, [themeValue, setTheme, initializing, activeTheme]);

  // Bootstrap profile + preferences from the API
  React.useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        const [meRes, prefsRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/admin/settings/preferences", { cache: "no-store" }),
        ]);

        if (!ignore) {
          if (meRes.ok) {
            const json = await meRes.json().catch(() => null);
            const data = json?.data;
            if (data) {
              const nextProfile: UserProfilePreview = {
                id: Number(data.id ?? 0),
                firstName: String(data.first_name ?? ""),
                lastName: String(data.last_name ?? ""),
                email: String(data.email ?? ""),
                role: (data.role ?? "ADMIN") as UserProfilePreview["role"],
                status: (data.status ?? "ACTIVE") as UserProfilePreview["status"],
              };
              setProfile(nextProfile);
              resetProfile({
                firstName: nextProfile.firstName,
                lastName: nextProfile.lastName,
              });
            }
          } else if (meRes.status === 401) {
            toast.error("Session expired. Please sign in again.", { id: "settings-auth" });
          } else {
            const errorPayload = await meRes.json().catch(() => ({}));
            const message = errorPayload?.error ?? "Failed to load profile.";
            toast.error(message);
          }

          if (prefsRes.ok) {
            const json = await prefsRes.json().catch(() => null);
            const data = json?.data as UserSettings | undefined;
            const nextPrefs: UserSettings = data ?? {
              ...DEFAULT_USER_SETTINGS,
            };
            setPreferences(nextPrefs);
            resetPrefs({
              theme: nextPrefs.theme,
              defaultDateRange: nextPrefs.defaultDateRange,
            });
          } else {
            const errorPayload = await prefsRes.json().catch(() => ({}));
            const message = errorPayload?.error ?? "Failed to load preferences. Using defaults.";
            toast.warning(message);
            setPreferences({
              ...DEFAULT_USER_SETTINGS,
            });
            resetPrefs({
              theme: DEFAULT_USER_SETTINGS.theme,
              defaultDateRange: DEFAULT_USER_SETTINGS.defaultDateRange,
            });
          }
        }
      } catch (error) {
        if (!ignore) {
          console.error("[settings] bootstrap failed", error);
          toast.error("Unable to load settings. Please refresh and try again.");
          setPreferences({
            ...DEFAULT_USER_SETTINGS,
          });
          resetPrefs({
            theme: DEFAULT_USER_SETTINGS.theme,
            defaultDateRange: DEFAULT_USER_SETTINGS.defaultDateRange,
          });
        }
      } finally {
        if (!ignore) {
          setInitializing(false);
        }
      }
    }

    void bootstrap();
    return () => {
      ignore = true;
    };
  }, [resetPrefs, resetProfile]);

  /* ---------- Handlers ---------- */

  const onSaveProfile = async (values: ProfileValues) => {
    if (initializing) return;
    try {
      const res = await fetch("/api/admin/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error ?? "Failed to update profile.";
        toast.error(message);
        return;
      }

      const data = json?.data;
      const nextProfile: UserProfilePreview = {
        id: Number(data?.id ?? profile?.id ?? 0),
        firstName: String(data?.first_name ?? values.firstName ?? ""),
        lastName: String(data?.last_name ?? values.lastName ?? ""),
        email: String(data?.email ?? profile?.email ?? ""),
        role: (data?.role ?? profile?.role ?? "ADMIN") as UserProfilePreview["role"],
        status: (data?.status ?? profile?.status ?? "ACTIVE") as UserProfilePreview["status"],
      };

      setProfile(nextProfile);
      resetProfile({
        firstName: nextProfile.firstName,
        lastName: nextProfile.lastName,
      });

      if (nextProfile.id && nextProfile.email) {
        writeCachedUser({
          id: nextProfile.id,
          firstName: nextProfile.firstName,
          lastName: nextProfile.lastName,
          email: nextProfile.email,
          role: nextProfile.role,
        });
      }

      toast.success("Profile saved.");
    } catch (error) {
      console.error("[settings] profile update failed", error);
      toast.error("Failed to update profile. Please try again.");
    }
  };

  const onSavePassword = async (values: PasswordValues) => {
    if (initializing) return;
    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current: values.current,
          next: values.next,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error ?? "Failed to update password.";
        toast.error(message);
        return;
      }
      resetPassword({ current: "", next: "", confirm: "" });
      toast.success("Password updated.");
    } catch (error) {
      console.error("[settings] password update failed", error);
      toast.error("Failed to update password. Please try again.");
    }
  };

  const onSavePreferences = async (values: PreferencesValues) => {
    if (initializing) return;
    const payload: UserSettings = {
      theme: values.theme as ThemeChoice,
      defaultDateRange: values.defaultDateRange as DateRangeChoice,
    };
    try {
      const res = await fetch("/api/admin/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = json?.error ?? "Failed to save preferences.";
        toast.error(message);
        if (preferences) {
          resetPrefs({
            theme: preferences.theme,
            defaultDateRange: preferences.defaultDateRange,
          });
        }
        return;
      }

      const data = json?.data as UserSettings | undefined;
      const saved: UserSettings = data ?? {
        ...payload,
        adminId: preferences?.adminId,
      };
      setPreferences(saved);
      resetPrefs({
        theme: saved.theme,
        defaultDateRange: saved.defaultDateRange,
      });
      persistDefaultDateRange(saved.defaultDateRange);
      toast.success("Preferences saved.");
    } catch (error) {
      console.error("[settings] preferences update failed", error);
      toast.error("Failed to save preferences. Please try again.");
      if (preferences) {
        resetPrefs({
          theme: preferences.theme,
          defaultDateRange: preferences.defaultDateRange,
        });
      }
    }
  };

  /* ---------- UI ---------- */

  return (
    <div className="mx-auto w-full max-w-5xl flex flex-col px-4 py-6 space-y-6">
      {/* Profile */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your name and view account details.</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <form
            className="space-y-6"
            onSubmit={handleSubmitProfile(onSaveProfile)}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-1 block text-sm font-medium"
                >
                  First name
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="firstName"
                  placeholder="First name"
                  disabled={initializing || profileBusy}
                  {...registerProfile("firstName")}
                />
                {profileErrors.firstName && (
                  <p className="mt-1 text-xs text-destructive">
                    {profileErrors.firstName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="mb-1 block text-sm font-medium"
                >
                  Last name
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="lastName"
                  placeholder="Last name"
                  disabled={initializing || profileBusy}
                  {...registerProfile("lastName")}
                />
                {profileErrors.lastName && (
                  <p className="mt-1 text-xs text-destructive">
                    {profileErrors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                  Email
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="email"
                  value={profile?.email ?? ""}
                  readOnly
                  disabled
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Role</span>
                <div>
                  <Badge variant="secondary">{profile?.role ?? "..."}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Status</span>
                <div>
                  <Badge
                    variant={profile?.status === "ACTIVE" ? "default" : "outline"}
                  >
                    {profile?.status ?? "..."}
                  </Badge>
                </div>
              </div>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={profileBusy || initializing}>
                Save Profile
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your password.</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <form
            className="space-y-6"
            onSubmit={handleSubmitPassword(onSavePassword)}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="current" className="mb-1 block text-sm font-medium">
                  Current password
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="current"
                  type="password"
                  placeholder="********"
                  autoComplete="current-password"
                  disabled={initializing || pwBusy}
                  {...registerPassword("current")}
                />
                {pwErrors.current && (
                  <p className="mt-1 text-xs text-destructive">
                    {pwErrors.current.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="next" className="mb-1 block text-sm font-medium">
                  New password
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="next"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  disabled={initializing || pwBusy}
                  {...registerPassword("next")}
                />
                {pwErrors.next && (
                  <p className="mt-1 text-xs text-destructive">
                    {pwErrors.next.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-medium"
                >
                  Confirm new password
                </label>
                <Input className="border-2 border-primary/30 shadow-lg"
                  id="confirm"
                  type="password"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  disabled={initializing || pwBusy}
                  {...registerPassword("confirm")}
                />
                {pwErrors.confirm && (
                  <p className="mt-1 text-xs text-destructive">
                    {pwErrors.confirm.message}
                  </p>
                )}
              </div>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={pwBusy || initializing}>
                Update Password
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Choose your default theme and starting dashboard date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <form
            className="space-y-6"
            onSubmit={handleSubmitPrefs(onSavePreferences)}
            noValidate
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Theme */}
              <div>
                <label htmlFor="theme" className="mb-1 block text-sm font-medium">
                  Default Theme
                </label>
                <Controller
                  control={controlPrefs}
                  name="theme"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as ThemeChoice)}
                      disabled={initializing || prefsBusy}
                    >
                      <SelectTrigger id="theme" disabled={initializing || prefsBusy}>
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LIGHT">Light</SelectItem>
                        <SelectItem value="DARK">Dark</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {prefsErrors.theme && (
                  <p className="mt-1 text-xs text-destructive">
                    {prefsErrors.theme.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Applies immediately (preview). Current: <code>{activeTheme ?? "system"}</code>
                </p>
              </div>

              {/* Date Range */}
              <div>
                <label
                  htmlFor="defaultDateRange"
                  className="mb-1 block text-sm font-medium"
                >
                  Default Date Range
                </label>
                <Controller
                  control={controlPrefs}
                  name="defaultDateRange"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as DateRangeChoice)
                      }
                      disabled={initializing || prefsBusy}
                    >
                      <SelectTrigger
                        id="defaultDateRange"
                        disabled={initializing || prefsBusy}
                      >
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAST_7">Last 7 days</SelectItem>
                        <SelectItem value="LAST_30">Last 30 days</SelectItem>
                        <SelectItem value="LAST_90">Last 90 days</SelectItem>
                        <SelectItem value="LAST_365">Last 12 months</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {prefsErrors.defaultDateRange && (
                  <p className="mt-1 text-xs text-destructive">
                    {prefsErrors.defaultDateRange.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Used as the starting window for dashboards.
                </p>
              </div>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={prefsBusy || initializing}>
                Save Preferences
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
