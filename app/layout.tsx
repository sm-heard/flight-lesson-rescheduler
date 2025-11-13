import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flight Lesson Rescheduler",
  description:
    "Monitor corridor weather, auto-cancel unsafe lessons, and triage reschedule notifications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}>
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Flight Schedule Pro
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Weather Ops
                </span>
              </div>
              <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
                <Link href="/" className="hover:text-slate-900">
                  Dashboard
                </Link>
                <Link href="/proposals" className="hover:text-slate-900">
                  Proposals
                </Link>
                <Link href="/notifications/outbox" className="hover:text-slate-900">
                  Outbox
                </Link>
              </nav>
            </div>
          </header>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
