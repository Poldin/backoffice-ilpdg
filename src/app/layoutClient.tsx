"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./components/Sidebar"

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideSidebar = pathname === "/" || pathname === "/login"

  if (hideSidebar) return <div className="min-h-screen">{children}</div>

  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 min-h-screen">{children}</div>
    </div>
  )
}


