import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { isPreparedClientError } from "../../../../src/lib/db/db-repository";
import {
  UnauthorizedError,
  getOrCreateCurrentUser,
} from "../../../../src/lib/server/current-user";
import { documentRepository } from "../../../../src/lib/server/repositories";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

function safeFilename(originalName: string): string {
  const stripped = originalName.replace(/[^\w.\-]+/g, "_");
  return stripped.length > 0 ? stripped : "upload.bin";
}

function getUploadsRoot(): string {
  return process.env.DOCUMENT_UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getOrCreateCurrentUser();
    const userId = user.id;
    const formData = await request.formData();
    const fileField = formData.get("file");
    if (!(fileField instanceof File)) {
      return NextResponse.json(
        { error: "Missing multipart file field named 'file'." },
        { status: 400 },
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(fileField.type)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Allowed: PDF, DOCX, TXT.",
        },
        { status: 400 },
      );
    }

    if (fileField.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 10 MB limit." },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const originalName = safeFilename(fileField.name || "upload.bin");
    const extension = originalName.includes(".")
      ? `.${originalName.split(".").pop()?.toLowerCase()}`
      : "";
    const storedFilename = `${id}${extension}`;
    const uploadsRoot = getUploadsRoot();
    const userDir = path.join(uploadsRoot, userId);
    const fullPath = path.join(userDir, storedFilename);

    await mkdir(userDir, { recursive: true });
    const bytes = new Uint8Array(await fileField.arrayBuffer());
    await writeFile(fullPath, bytes);

    const created = await documentRepository.createUploadedDocument({
      userId,
      filename: originalName,
      contentType: fileField.type,
      sizeBytes: fileField.size,
      filePath: fullPath,
      fileUrl: null,
    });

    if (!created) {
      return NextResponse.json(
        { error: "Failed to create uploaded document record." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        documentId: created.id,
        filename: created.filename,
        sizeBytes: created.size_bytes,
        contentType: created.content_type,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (isPreparedClientError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 502 },
      );
    }

    return NextResponse.json({ error: "Failed to upload file." }, { status: 500 });
  }
}
