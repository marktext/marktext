export const formatCount = (value: number, locale: string): string => {
  const safeValue = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat(locale).format(safeValue)
  } catch {
    return new Intl.NumberFormat('en').format(safeValue)
  }
}

export const formatCountPair = (
  total: number,
  selection: number | undefined,
  locale: string
): string => {
  const formattedTotal = formatCount(total, locale)
  if (selection == null) return formattedTotal
  return `${formatCount(selection, locale)} / ${formattedTotal}`
}

export const formatTimestamp = (
  value: number | null | undefined,
  locale: string
): string | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short'
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(value)
  } catch {
    return new Intl.DateTimeFormat('en', options).format(value)
  }
}
