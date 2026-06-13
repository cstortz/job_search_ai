import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  parseChatDockPosition,
  storeChatDockPosition,
  readStoredChatDockPosition,
  CHAT_DOCK_POSITION_STORAGE_KEY,
} from "./chat-dock";

describe("parseChatDockPosition", () => {
  it("defaults to bottom", () => {
    expect(parseChatDockPosition(null)).toBe("bottom");
    expect(parseChatDockPosition("invalid")).toBe("bottom");
  });

  it("parses valid positions", () => {
    expect(parseChatDockPosition("left")).toBe("left");
    expect(parseChatDockPosition("right")).toBe("right");
  });
});

describe("chat dock storage", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
  });

  it("round-trips through localStorage", () => {
    expect(readStoredChatDockPosition()).toBe("bottom");

    storeChatDockPosition("right");
    expect(readStoredChatDockPosition()).toBe("right");
    expect(storage.get(CHAT_DOCK_POSITION_STORAGE_KEY)).toBe("right");
  });
});
