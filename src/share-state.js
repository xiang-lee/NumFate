export function shareableNumbers(parsed) {
  const values = Array.isArray(parsed?.values) ? parsed.values : []
  const invalid = Array.isArray(parsed?.invalid) ? parsed.invalid : []

  if (invalid.length > 0) return []
  if (values.length < 2 || values.length > 12) return []
  return values
}
