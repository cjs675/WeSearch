import { getDocumentProxy } from 'unpdf'

export interface PdfText {
  text: string
  pageCount: number
}

export class PdfError extends Error {
  constructor(
    message: string,
    public code: 'not_pdf' | 'encrypted' | 'unreadable' | 'no_text',
  ) {
    super(message)
  }
}

interface Item {
  str: string
  x: number
  y: number
  width: number
  height: number
}

/** True if the bytes start with the PDF signature "%PDF-". */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.slice(0, 1024))
  return head.includes('%PDF-')
}

/**
 * Extract text from a PDF, rebuilding lines from item positions so that
 * headings, job headers and bullets stay on their own lines. Large horizontal
 * gaps become a tab, which the parser treats as a column separator
 * (e.g. "Cashier<TAB>June 2023 – Present").
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  if (!looksLikePdf(bytes)) throw new PdfError('The file is not a PDF.', 'not_pdf')

  let pdf
  try {
    // Copy: PDF.js may transfer/detach the buffer it is given.
    pdf = await getDocumentProxy(new Uint8Array(bytes))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/password/i.test(msg)) throw new PdfError('The PDF is password-protected.', 'encrypted')
    throw new PdfError('The PDF could not be read. It may be damaged.', 'unreadable')
  }

  const pages: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items: Item[] = []
    for (const raw of content.items as Array<Record<string, unknown>>) {
      if (typeof raw.str !== 'string') continue
      const t = raw.transform as number[]
      items.push({
        str: raw.str,
        x: t[4],
        y: t[5],
        width: (raw.width as number) ?? 0,
        height: (raw.height as number) || Math.abs(t[3]) || 10,
      })
    }
    pages.push(itemsToLines(items))
  }

  const text = pages.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  if (text.replace(/\s/g, '').length < 20) {
    throw new PdfError(
      'No selectable text was found. The PDF may be a scanned image — try exporting it as a text PDF or pasting the text instead.',
      'no_text',
    )
  }
  return { text, pageCount: pdf.numPages }
}

function itemsToLines(items: Item[]): string {
  const visible = items.filter((i) => i.str.length > 0)
  if (visible.length === 0) return ''

  // Group items whose baselines are within ~40% of the text height.
  const sorted = [...visible].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Item[][] = []
  for (const item of sorted) {
    const line = lines[lines.length - 1]
    const tol = Math.max(2, item.height * 0.4)
    if (line && Math.abs(line[0].y - item.y) <= tol) line.push(item)
    else lines.push([item])
  }

  const out: string[] = []
  let prevY: number | undefined
  let prevH = 10
  for (const line of lines) {
    line.sort((a, b) => a.x - b.x)
    let s = ''
    let end: number | undefined
    for (const it of line) {
      if (end !== undefined) {
        const gap = it.x - end
        const em = it.height || 10
        if (gap > em * 2.5) s += '\t'
        else if (gap > em * 0.15 && !s.endsWith(' ') && !it.str.startsWith(' ')) s += ' '
      }
      s += it.str
      end = it.x + it.width
    }
    const y = line[0].y
    // A clearly larger vertical gap means a new block; keep it as a blank line.
    if (prevY !== undefined && prevY - y > prevH * 2.2) out.push('')
    out.push(s.replace(/[  ]+/g, ' ').trimEnd())
    prevY = y
    prevH = line[0].height || prevH
  }
  return out.join('\n')
}
