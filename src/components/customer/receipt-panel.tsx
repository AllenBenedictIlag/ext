// app/customer/auth/components/ReceiptPanel.tsx
"use client";

import Image from "next/image";
import * as React from "react";

export function ReceiptPanel({
  imageSrc = "/images/receipt.png",
  title = "Receipt",
  subtitle = "Preview",
  caption = "Sample only",
  aspect = "aspect-[7/12]",
  showBadge = true,
  footer,
}: {
  imageSrc?: string;
  title?: string;
  subtitle?: string;
  caption?: string;
  aspect?: string;
  showBadge?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{title}</h2>
          {showBadge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] leading-none text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>

        <div className={`relative overflow-hidden rounded-xl border border-muted-foreground/30 bg-muted/20 ${aspect}`}>
          <Image
            src={imageSrc}
            alt="Receipt preview"
            fill
            className="object-contain p-3"
            priority
            sizes="(min-width: 768px) 440px, 90vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
          {caption ? (
            <div className="absolute bottom-2 left-2 rounded bg-background/70 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
              {caption}
            </div>
          ) : null}
        </div>

        {footer ? <div className="pt-1">{footer}</div> : null}
      </div>
    </div>
  );
}
