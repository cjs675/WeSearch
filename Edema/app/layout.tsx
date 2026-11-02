import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'scout. — Resume analyzer',
  description: 'Upload a resume to pull out your skills, find job categories that fit, and get search keywords.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
