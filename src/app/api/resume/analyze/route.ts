import { extractText, getDocumentProxy } from "unpdf";
import { allowRequest } from "@/features/job-matching/rate-limit";
import { analyzeResumeText } from "@/features/resume-analysis/parser";

const MAX_FILE_BYTES = 5_000_000;
const MIN_TEXT_CHARS = 20;

/** Body: multipart form with a PDF in `file`. The file is read in memory and never stored or logged. */
export async function POST(request: Request) {
  if (!allowRequest(request)) return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Send the resume as a PDF file." }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ error: "Send the resume as a PDF file." }, { status: 400 });
  if (file.size > MAX_FILE_BYTES) return Response.json({ error: "That file is larger than 5 MB." }, { status: 413 });

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    text = (await extractText(pdf, { mergePages: true })).text;
  } catch {
    return Response.json({ error: "That file couldn't be read as a PDF." }, { status: 422 });
  }
  if (text.trim().length < MIN_TEXT_CHARS) {
    return Response.json({ error: "No text found in this PDF. It may be a scanned image, which this app can't read yet." }, { status: 422 });
  }
  return Response.json(analyzeResumeText(text));
}
