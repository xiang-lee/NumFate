export function isSubmitShortcut(event) {
  return event.key === 'Enter' && !event.isComposing && !event.shiftKey && (event.ctrlKey || event.metaKey)
}
