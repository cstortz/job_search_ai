export const CHAT_DOCK_POSITIONS = ["bottom", "left", "right"] as const;

export type ChatDockPosition = (typeof CHAT_DOCK_POSITIONS)[number];

export const CHAT_DOCK_POSITION_STORAGE_KEY = "job-search-ai-chat-dock-position";

export const CHAT_DOCK_POSITION_LABELS: Record<ChatDockPosition, string> = {
  bottom: "Bottom",
  left: "Left side",
  right: "Right side",
};

export function isChatDockPosition(value: string): value is ChatDockPosition {
  return (CHAT_DOCK_POSITIONS as readonly string[]).includes(value);
}

export function parseChatDockPosition(value: string | null | undefined): ChatDockPosition {
  if (value && isChatDockPosition(value)) {
    return value;
  }
  return "bottom";
}

export function readStoredChatDockPosition(): ChatDockPosition {
  if (typeof window === "undefined") {
    return "bottom";
  }
  return parseChatDockPosition(
    window.localStorage.getItem(CHAT_DOCK_POSITION_STORAGE_KEY),
  );
}

export function storeChatDockPosition(position: ChatDockPosition) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CHAT_DOCK_POSITION_STORAGE_KEY, position);
}
