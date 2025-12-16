import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import AuthStatus from '@/components/AuthStatus'
import { QueryProvider } from '@/lib/providers/query-provider'
import "./globals.css"

export const metadata: Metadata = {
  title: "ascutzit.ro – CRM (Leads)",
  description: "CRM system for managing leads and sales pipeline",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <QueryProvider>
          <header className="flex items-center justify-between p-4 border-b">
            <div className="font-semibold">Ascutzit CRM</div>
            <AuthStatus />
          </header>
          <Suspense fallback={null}>{children}</Suspense>
          <Analytics />
        </QueryProvider>
      </body>
    </html>
  )
}
