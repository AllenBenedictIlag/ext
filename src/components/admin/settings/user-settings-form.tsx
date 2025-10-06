// src/components/admin/settings/user-settings-form.tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useForm, Controller } from "react-hook-form";
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
import {
  DEFAULT_USER_SETTINGS,
  SAMPLE_USER_PROFILE,
} from "@/types/settings";

/* ---------- Helpers ---------- */

const themeChoiceToNextThemes = (t: ThemeChoice): "light" | "dark" | "system" =>
  t === "LIGHT" ? "light" : t === "DARK" ? "dark" : "system";

/* ---------- Zod Schemas (UI-only) ---------- */

const ProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  // email/role/status are read-only, not validated for submission here
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
  ]),
});

type ProfileValues = z.infer<typeof ProfileSchema>;
type PasswordValues = z.infer<typeof PasswordSchema>;
type PreferencesValues = z.infer<typeof PreferencesSchema>;

/* ---------- Component ---------- */

export default function UserSettingsForm() {
  // Fake profile data (no fetch).
  const profile: UserProfilePreview = SAMPLE_USER_PROFILE;

  // Theme interop (applies immediately on select change)
  const { setTheme, theme: activeTheme } = useTheme();

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isSubmitting: profileBusy },
    reset: resetProfile,
  } = useForm<ProfileValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
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

  // Apply theme immediately on change (optimistic)
  const themeValue = watchPrefs("theme");
  React.useEffect(() => {
    if (!themeValue) return;
    setTheme(themeChoiceToNextThemes(themeValue));
    // Note: still require Save to "persist" later; currently just logs + toast.
  }, [themeValue, setTheme]);

  /* ---------- Handlers ---------- */

  const onSaveProfile = (values: ProfileValues) => {
    // TODO: wire PUT /api/account/profile with { first_name, last_name }
    console.log("PROFILE_SAVE", values);
    toast.success("Profile saved (UI only).");
    resetProfile(values);
  };

  const onSavePassword = (values: PasswordValues) => {
    // TODO: wire PUT /api/account/password
    console.log("PASSWORD_CHANGE", values);
    toast.success("Password updated (UI only).");
    resetPassword({ current: "", next: "", confirm: "" });
  };

  const onSavePreferences = (values: PreferencesValues) => {
    // TODO: wire PUT /api/account/settings
    const payload: UserSettings = {
      theme: values.theme as ThemeChoice,
      defaultDateRange: values.defaultDateRange as DateRangeChoice,
    };
    console.log("SETTINGS_SAVE", payload);
    toast.success("Preferences saved (UI only).");
    resetPrefs(values);
  };

  /* ---------- UI ---------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
      {/* Profile */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your name and view account details.</CardDescription>
        </CardHeader>
        <CardContent>
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
                <Input
                  id="firstName"
                  placeholder="First name"
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
                <Input
                  id="lastName"
                  placeholder="Last name"
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
                <Input id="email" value={profile.email} readOnly disabled />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Role</span>
                <div>
                  <Badge variant="secondary">{profile.role}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Status</span>
                <div>
                  <Badge
                    variant={profile.status === "ACTIVE" ? "default" : "outline"}
                  >
                    {profile.status}
                  </Badge>
                </div>
              </div>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={profileBusy}>
                Save Profile
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Change your password (UI only; no network calls).</CardDescription>
        </CardHeader>
        <CardContent>
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
                <Input
                  id="current"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
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
                <Input
                  id="next"
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
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
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
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
              <Button type="submit" disabled={pwBusy}>
                Update Password
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Choose your default theme and starting dashboard date range.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    >
                      <SelectTrigger id="theme">
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
                  Applies immediately (optimistic). Current: <code>{activeTheme ?? "system"}</code>
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
                    >
                      <SelectTrigger id="defaultDateRange">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LAST_7">Last 7 days</SelectItem>
                        <SelectItem value="LAST_30">Last 30 days</SelectItem>
                        <SelectItem value="LAST_90">Last 90 days</SelectItem>
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
                  Used only as the starting window for dashboards later.
                </p>
              </div>
            </div>

            <CardFooter className="px-0">
              <Button type="submit" disabled={prefsBusy}>
                Save Preferences
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
