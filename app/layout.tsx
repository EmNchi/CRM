import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import AuthStatus from '@/components/AuthStatus'
import { QueryProvider } from '@/lib/providers/query-provider'
import { AuthProvider } from '@/lib/contexts/AuthContext'
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Retry logic pentru webpack chunk loading errors
              (function() {
                const originalChunkLoadError = window.__NEXT_DATA__?.err;
                window.addEventListener('error', function(e) {
                  if (e.message && e.message.includes('Loading chunk') || e.message.includes('Failed to fetch dynamically imported module')) {
                    console.warn('Chunk loading error detected, attempting to reload...');
                    // Retry loading chunk-ul
                    if (e.filename) {
                      const script = document.createElement('script');
                      script.src = e.filename;
                      script.onerror = function() {
                        console.error('Failed to reload chunk:', e.filename);
                        // Dacă retry-ul eșuează, reîncarcă pagina completă
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      };
                      document.head.appendChild(script);
                    } else {
                      // Dacă nu avem filename, reîncarcă pagina
                      setTimeout(() => {
                        window.location.reload();
                      }, 1000);
                    }
                  }
                }, true);
                
                // Gestionare pentru unhandled promise rejections (chunk loading)
                window.addEventListener('unhandledrejection', function(e) {
                  if (e.reason && (
                    e.reason.message?.includes('Loading chunk') ||
                    e.reason.message?.includes('Failed to fetch dynamically imported module') ||
                    e.reason.message?.includes('ChunkLoadError')
                  )) {
                    console.warn('Chunk loading promise rejection, reloading page...');
                    e.preventDefault();
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          <QueryProvider>
            <header className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold">Ascutzit CRM</div>
              <AuthStatus />
            </header>
            <Suspense fallback={null}>{children}</Suspense>
            <Analytics />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
