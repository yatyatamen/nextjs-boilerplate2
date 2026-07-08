import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Westmount Badminton Club',
  description:
    'Member portal for the Westmount Badminton Club — schedules, bookings, announcements, shop, and skill tracking.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    /* OPTIMIZED: Keep min-h-screen to prevent background leaks, but let 
       the client component's useEffect handle adding/removing the 'dark' class dynamically!
    */
    <html lang="en" className="min-h-screen">
      <body className="font-sans antialiased min-h-screen">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}