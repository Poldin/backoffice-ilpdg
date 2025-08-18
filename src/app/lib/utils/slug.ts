/**
 * Generate a URL-friendly slug from a given string
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 */
export function generateSlug(text: string): string {
  if (!text) return ""
  
  return text
    .normalize("NFKD") // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase() // Convert to lowercase
    .trim() // Remove leading/trailing spaces
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric chars except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+/, "") // Remove leading hyphens
    .replace(/-+$/, "") // Remove trailing hyphens
}

/**
 * Validate if a slug is properly formatted
 * @param slug - The slug to validate
 * @returns True if the slug is valid
 */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false
  
  // Check if slug contains only lowercase letters, numbers, and hyphens
  // Must not start or end with hyphen
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/
  return slugRegex.test(slug)
}
