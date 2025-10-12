"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SiteFooterProps = {
  className?: string;
  brand?: string;
  extra?: React.ReactNode;
};

export function SiteFooter({
  className,
  brand = "Coffee Crave",
  extra,
}: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-label="Site footer"
      className={cn("border-t bg-muted/20 text-muted-foreground", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-center md:px-6 lg:px-8">
        <p className="text-xs sm:text-sm">
          © {year} {brand}. All rights reserved.
        </p>
        {extra && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">{extra}</p>
        )}
      </div>
    </footer>
  );
}
