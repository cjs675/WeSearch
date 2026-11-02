/** Date handling for resume lines: "Jun 2023 – Present", "06/2021 - 08/2022", "Summer 2024", "2019 to 2023". */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
const SEASONS: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 }

const MONTH_RE =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?'
const SEASON_RE = '(?:spring|summer|fall|autumn|winter)'
const YEAR_RE = '(?:19[5-9]\\d|20\\d\\d)'
const POINT_RE = `(?:(?:${MONTH_RE}|${SEASON_RE})\\s*,?\\s*${YEAR_RE}|\\d{1,2}\\s*/\\s*${YEAR_RE}|${YEAR_RE})`
const PRESENT_RE = '(?:present|current(?:ly)?|now|today|ongoing)'
const SEP_RE = '\\s*(?:-|–|—|~|to|until|through|thru)\\s*'

export const RANGE_REGEX = new RegExp(`(${POINT_RE})${SEP_RE}(${POINT_RE}|${PRESENT_RE})`, 'i')
const POINT_REGEX = new RegExp(`(?:(?:expected|anticipated|graduat(?:ed|ion|ing)|class of|est\\.?)\\s*:?\\s*)?(${POINT_RE})`, 'i')
const POINT_GLOBAL = new RegExp(POINT_RE, 'gi')

export interface YearMonth {
  year: number
  month: number
}

export interface DateInfo {
  /** The date text exactly as written. */
  text: string
  start?: YearMonth
  end?: YearMonth
  /** Ends in "Present"/"Current". */
  current: boolean
  /** Prefixed with "Expected"/"Anticipated". */
  expected: boolean
  index: number
}

export function parsePoint(s: string): YearMonth | undefined {
  const t = s.toLowerCase().trim()
  const slash = t.match(/^(\d{1,2})\s*\/\s*(\d{4})$/)
  if (slash) return { year: +slash[2], month: Math.min(12, Math.max(1, +slash[1])) }
  const year = t.match(/(\d{4})/)
  if (!year) return undefined
  const word = t.match(/^([a-z]+)/)
  let month = 0
  if (word) month = MONTHS[word[1].slice(0, 3)] ?? SEASONS[word[1]] ?? 0
  return { year: +year[1], month }
}

/** Find the first date or date range in a line. */
export function findDates(line: string): DateInfo | undefined {
  const range = line.match(RANGE_REGEX)
  if (range && range.index !== undefined) {
    const isPresent = new RegExp(`^${PRESENT_RE}$`, 'i').test(range[2].trim())
    const start = parsePoint(range[1])
    const end = isPresent ? undefined : parsePoint(range[2])
    return {
      text: range[0].trim(),
      start,
      end,
      current: isPresent,
      expected: /expected|anticipated/i.test(line),
      index: range.index,
    }
  }
  const point = line.match(POINT_REGEX)
  if (point && point.index !== undefined) {
    // Ignore bare 4-digit numbers that are clearly not years in context (e.g. "Suite 2010" is rare; accept).
    const p = parsePoint(point[1])
    if (!p) return undefined
    return {
      text: point[0].trim(),
      start: undefined,
      end: p,
      current: false,
      expected: /expected|anticipated|class of/i.test(point[0]),
      index: point.index,
    }
  }
  return undefined
}

/** Remove the date text (and any separator left dangling) from a line. */
export function stripDates(line: string, info: DateInfo): string {
  const before = line.slice(0, info.index)
  const after = line.slice(info.index + info.text.length)
  // Join with a tab so "Cashier<TAB>June 2024 – Present<TAB>Taco Bell" keeps its column break.
  return (before + '\t' + after)
    .replace(/\(\s*\)/g, ' ')
    .replace(/[ ]*[|,–—-]?[ ]*\t[ ]*[|,–—-]?[ ]*/g, '\t')
    .replace(/\t{2,}/g, '\t')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/^[\s|,–—-]+|[\s|,–—-]+$/g, '')
}

export function hasYear(line: string): boolean {
  POINT_GLOBAL.lastIndex = 0
  return POINT_GLOBAL.test(line)
}

function toIndex(ym: YearMonth, fallbackMonth: number): number {
  return ym.year * 12 + ((ym.month || fallbackMonth) - 1)
}

/** Month span [start, end] as absolute month indexes, or undefined when it can't be worked out. */
export function monthSpan(info: DateInfo | undefined, now: Date): [number, number] | undefined {
  if (!info?.start) return undefined
  const s = toIndex(info.start, 1)
  let e: number
  if (info.current) e = now.getFullYear() * 12 + now.getMonth()
  else if (info.end) e = toIndex(info.end, info.start.month && info.end.year === info.start.year ? info.start.month : 12)
  else return undefined
  const nowIdx = now.getFullYear() * 12 + now.getMonth()
  e = Math.min(e, nowIdx)
  if (e < s) return undefined
  return [s, e]
}

/** Total months covered by a set of spans, with overlaps counted once. */
export function mergedMonths(spans: [number, number][]): number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0])
  let total = 0
  let cur: [number, number] | undefined
  for (const [s, e] of sorted) {
    if (!cur || s > cur[1] + 1) {
      if (cur) total += cur[1] - cur[0] + 1
      cur = [s, e]
    } else cur[1] = Math.max(cur[1], e)
  }
  if (cur) total += cur[1] - cur[0] + 1
  return total
}
