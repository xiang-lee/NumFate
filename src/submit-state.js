export function getSubmitState(parsed, isLoading = false) {
  if (isLoading) {
    return {
      disabled: true,
      label: '命盘推演中...',
      loading: true,
    }
  }

  const count = Array.isArray(parsed?.values) ? parsed.values.length : 0
  const invalidCount = Array.isArray(parsed?.invalid) ? parsed.invalid.length : 0

  if (invalidCount > 0) {
    return {
      disabled: true,
      label: '先修正无效项',
      loading: false,
    }
  }

  if (count < 2) {
    return {
      disabled: true,
      label: '至少输入 2 个数字',
      loading: false,
    }
  }

  if (count > 12) {
    return {
      disabled: true,
      label: '最多输入 12 个数字',
      loading: false,
    }
  }

  return {
    disabled: false,
    label: '开启命盘推演',
    loading: false,
  }
}
