import type { Database } from "./database.type"

export type CoverItem = Database["public"]["Tables"]["products_cover_items"]["Row"]
export type CoverItemInsert = Database["public"]["Tables"]["products_cover_items"]["Insert"]
export type CoverItemUpdate = Database["public"]["Tables"]["products_cover_items"]["Update"]

export type Category = Database["public"]["Tables"]["products_categories"]["Row"]
export type CategoryInsert = Database["public"]["Tables"]["products_categories"]["Insert"]
export type CategoryUpdate = Database["public"]["Tables"]["products_categories"]["Update"]

export type CategoryItem = Database["public"]["Tables"]["products_categories_items"]["Row"]
export type CategoryItemInsert = Database["public"]["Tables"]["products_categories_items"]["Insert"]
export type CategoryItemUpdate = Database["public"]["Tables"]["products_categories_items"]["Update"]

export type Profile = Database["public"]["Tables"]["profile"]["Row"]


