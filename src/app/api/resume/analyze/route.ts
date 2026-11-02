import { NextResponse } from "next/server";
import { parseResumeText } from "@/features/resume-analysis/analyze";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let rawText = "";
    let uploadedPdf = false;

    if (contentType.includes("application/json")) {
      const data = (await req.json().catch(() => null)) as { text?: unknown } | null;
      rawText = typeof data?.text === "string" ? data.text : "";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (file && typeof file !== "string") {
        const buffer = Buffer.from(await file.arrayBuffer());
        // PDFs can't be read as plain text; say so instead of returning garbage.
        uploadedPdf = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
        if (!uploadedPdf) {
          rawText = buffer.toString("utf-8");
        }
      }
    }

    if (uploadedPdf) {
      return NextResponse.json(
        { error: "PDF files aren't supported yet — please paste your resume text instead." },
        { status: 400 }
      );
    }
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "No text was provided to analyze. Paste your background text and try again." },
        { status: 400 }
      );
    }

    const resume = parseResumeText(rawText);
    return NextResponse.json({ resume });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: `Failed to analyze resume: ${message}` },
      { status: 500 }
    );
  }
}
