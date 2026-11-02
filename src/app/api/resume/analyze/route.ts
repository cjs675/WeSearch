import { NextResponse } from "next/server";
import { parseResumeText } from "@/features/resume-analysis/analyze";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let rawText = "";

    if (contentType.includes("application/json")) {
      const data = await req.json();
      rawText = data.text || "";
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (file && typeof file !== "string") {
        // Simple extraction of text content from uploaded text/plain or string representation
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        rawText = buffer.toString("utf-8");
      }
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
