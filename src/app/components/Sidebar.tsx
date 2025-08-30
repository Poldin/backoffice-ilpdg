"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { Image, FolderTree, User, LogOut, PanelLeftClose, PanelLeftOpen, ExternalLink, Users, Link2 } from "lucide-react"
import { getAccessibleRoutes, type UserRole } from "@/app/lib/acl"
import { getSupabaseBrowser } from "@/app/lib/supabase/client"

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  position?: "top" | "bottom"
  external?: boolean
}

// Mappa per associare le icone ai path
const ICON_MAP: Record<string, React.ReactNode> = {
  "/cover": <Image className="h-5 w-5" />,
  "/categories": <FolderTree className="h-5 w-5" />,
  "/selling-links": <Link2 className="h-5 w-5" />,
  "/users": <Users className="h-5 w-5" />,
  "https://analytics.google.com/analytics/web/?hl=it#/p498367036/reports/intelligenthome": <ExternalLink className="h-5 w-5" />,
  "/brand/products": <Image className="h-5 w-5" />,
  "/brand/links": <Link2 className="h-5 w-5" />,
  "/profile": <User className="h-5 w-5" />,
  "/logout": <LogOut className="h-5 w-5" />,
}

const LOCAL_STORAGE_KEY = "sidebar:collapsed"

export default function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [navItems, setNavItems] = useState<NavItem[]>([])

  // Carica il ruolo utente e genera i nav items
  useEffect(() => {
    async function loadUserRole() {
      try {
        const supabase = getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profile')
            .select('role')
            .eq('user_id', session.user.id)
            .single()
          
          if (profile?.role) {
            setUserRole(profile.role as UserRole)
            
            // Genera i nav items basati sui permessi
            const accessibleRoutes = getAccessibleRoutes(profile.role as UserRole)
            const items: NavItem[] = accessibleRoutes.map(route => ({
              href: route.path,
              label: route.label,
              icon: ICON_MAP[route.path] || <div className="h-5 w-5" />,
              position: route.position,
              external: route.external
            }))
            
            setNavItems(items)
          }
        }
      } catch (error) {
        console.error('Error loading user role:', error)
      }
    }
    
    loadUserRole()
  }, [])

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

  const topItems = navItems.filter((i: NavItem) => i.position !== "bottom")
  const bottomItems = navItems.filter((i: NavItem) => i.position === "bottom")

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
            <span className="font-semibold text-sm whitespace-nowrap">back.bant1.com</span>
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
          {topItems.map((item: NavItem) => {
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
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
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
          {bottomItems.map((item: NavItem) => {
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
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
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


