"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UnsavedReason = "navigate" | "signout";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  markDirty: () => void;
  markPristine: () => void;
  confirmExit: (reason?: UnsavedReason) => Promise<boolean>;
};

const UnsavedChangesContext = React.createContext<
  UnsavedChangesContextValue | null
>(null);

const MESSAGE_BY_REASON: Record<
  UnsavedReason,
  { title: string; description: string; confirmLabel: string; cancelLabel: string }
> = {
  navigate: {
    title: "Unsaved changes",
    description: "You have unsaved changes. They will be lost if you continue. Proceed?",
    confirmLabel: "Leave page",
    cancelLabel: "Stay",
  },
  signout: {
    title: "Unsaved changes",
    description:
      "The questions in construction will not be saved if you sign out. Do you want to proceed?",
    confirmLabel: "Sign out",
    cancelLabel: "Cancel",
  },
};

function currentPathnameWithSearch(): string {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isDirty, setIsDirty] = React.useState(false);
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    reason: UnsavedReason;
  } | null>(null);

  const resolverRef = React.useRef<(value: boolean) => void>();
  const suppressPopRef = React.useRef(false);
  const stablePathRef = React.useRef<string>(
    typeof window !== "undefined" ? currentPathnameWithSearch() : ""
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    stablePathRef.current = currentPathnameWithSearch();
  }, [pathname, searchParams]);

  const closeDialog = React.useCallback((result: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = undefined;
    setDialog(null);
    if (resolver) resolver(result);
  }, []);

  const confirmExit = React.useCallback(
    (reason: UnsavedReason = "navigate") => {
      if (!isDirty) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setDialog({ open: true, reason });
      });
    },
    [isDirty]
  );

  const markDirty = React.useCallback(() => {
    setIsDirty(true);
  }, []);

  const markPristine = React.useCallback(() => {
    setIsDirty(false);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleClick = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.getAttribute("data-unsaved-ignore") === "true") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      confirmExit("navigate").then((ok) => {
        if (!ok) return;
        suppressPopRef.current = true;
        markPristine();
        router.push(`${url.pathname}${url.search}${url.hash}`);
      });
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [confirmExit, isDirty, markPristine, router]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handlePopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        stablePathRef.current = currentPathnameWithSearch();
        return;
      }
      if (!isDirty) {
        stablePathRef.current = currentPathnameWithSearch();
        return;
      }
      const targetPath = currentPathnameWithSearch();
      confirmExit("navigate").then((ok) => {
        if (ok) {
          markPristine();
          stablePathRef.current = targetPath;
        } else {
          suppressPopRef.current = true;
          const restore = stablePathRef.current;
          router.push(restore);
        }
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [confirmExit, isDirty, markPristine, router]);

  const contextValue = React.useMemo<UnsavedChangesContextValue>(
    () => ({
      isDirty,
      markDirty,
      markPristine,
      confirmExit,
    }),
    [confirmExit, isDirty, markDirty, markPristine]
  );

  const activeDialog = dialog && dialog.open ? dialog : null;
  const message = activeDialog ? MESSAGE_BY_REASON[activeDialog.reason] : null;

  return (
    <UnsavedChangesContext.Provider value={contextValue}>
      {children}
      <AlertDialog
        open={Boolean(activeDialog)}
        onOpenChange={(open) => {
          if (!open) closeDialog(false);
        }}
      >
        {message ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{message.title}</AlertDialogTitle>
              <AlertDialogDescription>{message.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  closeDialog(false);
                }}
              >
                {message.cancelLabel}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  closeDialog(true);
                }}
              >
                {message.confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(): UnsavedChangesContextValue {
  const ctx = React.useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return ctx;
}
