// Access Control List (ACL) - definisce i permessi per ogni ruolo utente

export type UserRole = "super_admin" | "brand" | "cep"

export interface RoutePermission {
  path: string
  label: string
  icon?: string
  allowedRoles: UserRole[]
  position?: "top" | "bottom"
  external?: boolean
}

// Definizione di tutte le route e i loro permessi
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  {
    path: "/cover",
    label: "Cover",
    allowedRoles: ["super_admin"],
    position: "top"
  },
  {
    path: "/categories",
    label: "Categories", 
    allowedRoles: ["super_admin"],
    position: "top"
  },
  {
    path: "/selling-links",
    label: "Selling Links",
    allowedRoles: ["super_admin"],
    position: "top"
  },
  {
    path: "/users",
    label: "Gestione Utenti",
    allowedRoles: ["super_admin"],
    position: "top"
  },
  {
    path: "https://analytics.google.com/analytics/web/?hl=it#/p498367036/reports/intelligenthome",
    label: "Google Analytics",
    allowedRoles: ["super_admin"],
    position: "top",
    external: true
  },
  {
    path: "/brand/products",
    label: "Prodotti",
    allowedRoles: ["brand"],
    position: "top"
  },
  {
    path: "/brand/links",
    label: "Link",
    allowedRoles: ["brand"],
    position: "top"
  },
  {
    path: "/profile",
    label: "Profilo",
    allowedRoles: ["super_admin", "brand", "cep"],
    position: "bottom"
  },
  {
    path: "/logout",
    label: "Logout",
    allowedRoles: ["super_admin", "brand", "cep"],
    position: "bottom"
  }
]

// Route pubbliche che non richiedono autenticazione
export const PUBLIC_ROUTES = ["/", "/login", "/register", "/reset-password", "/auth/callback"]

/**
 * Verifica se un utente ha accesso a una specifica route
 */
export function hasAccess(userRole: UserRole | null, path: string): boolean {
  // Le route pubbliche sono sempre accessibili
  if (PUBLIC_ROUTES.includes(path)) {
    return true
  }

  // Se non c'è un ruolo, negare l'accesso
  if (!userRole) {
    return false
  }

  // Trova la configurazione della route
  const routeConfig = ROUTE_PERMISSIONS.find(route => {
    // Per route esterne, confronto esatto
    if (route.external) {
      return route.path === path
    }
    // Per route interne, controlla se il path inizia con la route (per gestire sub-routes)
    return path.startsWith(route.path)
  })

  // Se la route non è configurata, permettere l'accesso solo ai super_admin
  if (!routeConfig) {
    return userRole === "super_admin"
  }

  // Verifica se il ruolo è autorizzato
  return routeConfig.allowedRoles.includes(userRole)
}

/**
 * Ottiene tutte le route accessibili per un ruolo specifico
 */
export function getAccessibleRoutes(userRole: UserRole | null): RoutePermission[] {
  if (!userRole) {
    return []
  }

  return ROUTE_PERMISSIONS.filter(route => 
    route.allowedRoles.includes(userRole)
  )
}

/**
 * Verifica se un ruolo è valido
 */
export function isValidRole(role: string | null): role is UserRole {
  return role !== null && ["super_admin", "brand", "cep"].includes(role)
}

/**
 * Ottiene la route di default per un ruolo (dove reindirizzare dopo il login)
 */
export function getDefaultRoute(userRole: UserRole): string {
  // Tutti gli utenti vengono reindirizzati al profilo dopo il login
  return "/profile"
}
