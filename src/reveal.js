export function needsReveal(rect, viewportHeight) {
  return rect.top < 0 || rect.bottom > viewportHeight
}

export function scrollBehavior(prefersReducedMotion) {
  return prefersReducedMotion ? 'auto' : 'smooth'
}
