// Keep hints available when errors appear; callers render the matching IDs next to the field.
export function fieldAccessibility(id: string, error?: string, hint = false) {
  return { "aria-invalid": !!error, "aria-describedby": [hint ? id + "-hint" : "", error ? id + "-error" : ""].filter(Boolean).join(" ") || undefined };
}
