"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Image, FolderTree, User, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  position?: "top" | "bottom"
}

const NAV_ITEMS: NavItem[] = [
  { href: "/cover", label: "Cover", icon: <Image className="h-5 w-5" /> },
  { href: "/categories", label: "Categories", icon: <FolderTree className="h-5 w-5" /> },
  { href: "/profile", label: "Profilo", icon: <User className="h-5 w-5" />, position: "bottom" },
  { href: "/logout", label: "Logout", icon: <LogOut className="h-5 w-5" />, position: "bottom" },
]

const LOCAL_STORAGE_KEY = "sidebar:collapsed"

export default function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored === "true") setIsCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(isCollapsed))
    } catch {
      // ignore
    }
  }, [isCollapsed])

  const topItems = NAV_ITEMS.filter((i) => i.position !== "bottom")
  const bottomItems = NAV_ITEMS.filter((i) => i.position === "bottom")

  return (
    <aside
      className={
        "h-screen border-r border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/20 " +
        "transition-all duration-200 ease-in-out flex flex-col sticky top-0"
      }
      style={{ width: isCollapsed ? 64 : 280 }}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 overflow-hidden">

          {!isCollapsed && (
            <span className="font-semibold text-sm whitespace-nowrap">Backoffice - ilPDG</span>
          )}
        </div>
        <button
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsCollapsed((v) => !v)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-black/5 dark:hover:bg-white/10"
          title={isCollapsed ? "Espandi" : "Collassa"}
        >
          {isCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 px-2">
        <ul className="space-y-1">
          {topItems.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors " +
                    (isActive
                      ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
                      : "hover:bg-black/5 dark:hover:bg-white/10")
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="text-current">{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-2 pb-3">
        <ul className="space-y-1">
          {bottomItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "group flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors " +
                    (isActive
                      ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
                      : "hover:bg-black/5 dark:hover:bg-white/10")
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="text-current">{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}


