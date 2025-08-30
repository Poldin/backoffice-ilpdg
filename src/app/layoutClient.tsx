"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./components/Sidebar"
import { Toaster } from "sonner"

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideSidebar = pathname === "/" || pathname === "/login" || pathname === "/register"

  if (hideSidebar) return (
    <div className="min-h-screen">
      {children}
      <Toaster 
        theme="dark"
        richColors 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#1a1f36',
            border: '1px solid #2d3748',
            color: '#ffffff',
          },
        }}
      />
    </div>
  )

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen">
        {children}
        <Toaster 
          theme="dark"
          richColors 
          position="top-right" 
          toastOptions={{
            style: {
              background: '#1a1f36',
              border: '1px solid #2d3748',
              color: '#ffffff',
            },
          }}
        />
      </div>
    </div>
  )
}


