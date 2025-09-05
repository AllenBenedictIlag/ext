// app/customer/auth/page.tsx
"use client";

import * as React from "react";
import { ReceiptPanel } from "@/components/customer/receipt-panel";
import { CustomerAuthCard } from "@/components/customer/auth-card";
import { ModeToggle } from "@/components/ui/theme-button";

export default function FeedbackAuthPage() {
  return (
    <main className="relative min-h-dvh bg-sidebar text-foreground">
      <div className="absolute right-3 top-3 z-50">
        <ModeToggle />
      </div>
      <div className="mx-auto grid w-full max-w-6xl min-h-dvh grid-cols-1 gap-8 px-4 py-8 md:grid-cols-[minmax(270px,390px)_1fr] md:gap-10 md:px-6 lg:px-8">
        <div className="order-2 mt-12 md:order-1">
          <ReceiptPanel />
        </div>

        <section className="order-1 flex flex-col gap-6 md:order-2 md:gap-8">
          <header className="m-5 space-y-3 pt-7">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                <span className="font-extrabold">Coffee Crave </span> - Your Opinion Matters
              </h1>
              <p className="mt-2 text-sm text-muted-foreground text-justify">
                With your suggestions, we can improve the Coffee Crave experience. Please be
                advised that Coffee Crave will use the responses you provide in this survey to
                better understand, manage, and improve your experience.
              </p>
            </div>
          </header>

          <div className="w-full">
            <CustomerAuthCard />
          </div>
        </section>
      </div>
    </main>
  );
}
