# Prepared DB Layer Usage

This folder provides a server-side wrapper over the Database API Prepared SQL endpoints.

## Files

- `prepared-client.ts`: low-level typed client for `/crud/prepared/*`.
- `db-repository.ts`: repository base class + domain repository example.
- `prepared-client.test.ts`: unit tests for endpoint mapping and client errors.
- `db-repository.test.ts`: unit tests for repository behavior and SQL wiring.

## Why this pattern

- Keeps SQL out of UI/client components.
- Centralizes transport concerns (timeouts, errors, parsing).
- Lets feature code call domain methods instead of raw SQL operations.

## Recommended usage flow

1. Define SQL templates in a server module.
2. Instantiate a repository with those templates.
3. Call repository methods from Route Handlers or Server Actions.
4. Return sanitized domain DTOs to the browser.

## Example: wire SQL templates

```ts
import { DocumentRepository } from "@/src/lib/db/db-repository";

const documentSql = {
  listDocumentsByUser: `
    SELECT id, user_id, filename, content_type, size_bytes, status, uploaded_at
    FROM documents
    WHERE user_id = :user_id
    ORDER BY uploaded_at DESC
  `,
  findDocumentByIdForUser: `
    SELECT id, user_id, filename, content_type, size_bytes, status, uploaded_at
    FROM documents
    WHERE id = :document_id AND user_id = :user_id
    LIMIT 1
  `,
  deleteDocumentByIdForUser: `
    DELETE FROM documents
    WHERE id = :document_id AND user_id = :user_id
  `,
};

export const documentRepository = new DocumentRepository(documentSql);
```

## Example: use from a route handler

```ts
import { NextRequest, NextResponse } from "next/server";
import { documentRepository } from "@/src/lib/server/repositories";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 401 });
  }

  const rows = await documentRepository.listByUserId(userId);
  return NextResponse.json({ documents: rows });
}
```

## Notes

- The Prepared SQL API uses named parameters in your SQL with a JSON `parameters` object.
- Validate new SQL with `client.validatePreparedSql(...)` during development if needed.
- Keep this code server-only. Do not import repositories into client components.

## Running tests

These tests use Vitest syntax. After frontend scaffolding adds a package manager setup:

```bash
npx vitest run services/job-search-web/src/lib/db/*.test.ts
```
