export function collectMetrics(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  const sum = numbers.reduce((acc, n) => acc + n, 0)
  const mean = sum / numbers.length
  const median =
    numbers.length % 2 === 1
      ? sorted[(numbers.length - 1) / 2]
      : (sorted[numbers.length / 2 - 1] + sorted[numbers.length / 2]) / 2
  const spread = sorted[sorted.length - 1] - sorted[0]
  const oddCount = numbers.filter((n) => Math.abs(Math.round(n)) % 2 === 1).length
  const evenCount = numbers.length - oddCount
  const primeCount = numbers.filter((n) => isPrime(Math.abs(Math.round(n)))).length
  const roundedSum = Math.abs(Math.round(sum))
  const digitalRoot = roundedSum === 0 ? 0 : ((roundedSum - 1) % 9) + 1

  return {
    count: numbers.length,
    sum: Number(sum.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    spread: Number(spread.toFixed(4)),
    oddCount,
    evenCount,
    primeCount,
    digitalRoot,
  }
}

function isPrime(value) {
  if (!Number.isInteger(value) || value < 2) return false
  for (let i = 2; i * i <= value; i += 1) {
    if (value % i === 0) return false
  }
  return true
}
