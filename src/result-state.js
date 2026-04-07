import { getSubmitState } from './submit-state.js'

export function isResultStale(currentValues, submittedValues, hasInvalid = false) {
  if (!Array.isArray(submittedValues) || submittedValues.length === 0) return false
  if (hasInvalid || !Array.isArray(currentValues)) return true
  if (currentValues.length !== submittedValues.length) return true
  return currentValues.some((value, index) => value !== submittedValues[index])
}

export function shouldOfferResultRefresh(isStale, parsed, isLoading = false) {
  if (!isStale) return false
  return !getSubmitState(parsed, isLoading).disabled
}
