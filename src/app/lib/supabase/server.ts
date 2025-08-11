import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "../database.type"

export function getSupabaseServer() {
  return createServerComponentClient<Database>({ cookies })
}


