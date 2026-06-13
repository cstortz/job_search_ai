import { beforeEach, describe, expect, it, vi } from "vitest";

import { PreparedClient, PreparedClientError } from "./prepared-client";

describe("PreparedClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls select endpoint and returns parsed response", async () => {
    const fakeResponse = {
      success: true,
      message: "ok",
      data: [{ id: "1" }],
      row_count: 1,
      affected_rows: null,
      sql: "SELECT * FROM documents",
      parameters: { user_id: "u1" },
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(fakeResponse),
    } as Response);

    const client = new PreparedClient({ baseUrl: "http://db.test" });
    const result = await client.preparedSelect<{ id: string }>({
      sql: "SELECT * FROM documents WHERE user_id = :user_id",
      parameters: { user_id: "u1" },
    });

    expect(result).toEqual(fakeResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://db.test/crud/prepared/select",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
      }),
    );
  });

  it("encodes statement name on clearPreparedStatement", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    } as Response);

    const client = new PreparedClient({ baseUrl: "http://db.test" });
    await client.clearPreparedStatement("stmt with spaces");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://db.test/crud/prepared/statements/stmt%20with%20spaces",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("throws PreparedClientError with mapped 422 message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ detail: "bad request" }),
    } as Response);

    const client = new PreparedClient({ baseUrl: "http://db.test" });

    await expect(
      client.validatePreparedSql({ sql: "SELECT * FROM x WHERE id = :id" }),
    ).rejects.toMatchObject<Partial<PreparedClientError>>({
      name: "PreparedClientError",
      status: 422,
      message: "bad request",
    });
  });
});

