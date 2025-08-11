"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "../database.type"

export function getSupabaseBrowser() {
  return createClientComponentClient<Database>()
}


