"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";

import {
  ApiRequestError,
  type ChatMessageRecord,
  listChatConversationMessages,
  listChatConversations,
  openChatStream,
  postChatMessage,
} from "../../src/lib/api/chat-client";

const CONVERSATION_STORAGE_KEY = "job-search-ai-chat-conversation-id";

const QUICK_PROMPTS = [
  "Review my resume for a senior engineering role.",
  "What should I highlight from my profile?",
  "Help me prepare for a technical interview.",
];

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function toDisplayMessage(message: ChatMessageRecord): DisplayMessage | null {
  if (message.role !== "user" && message.role !== "assistant") {
    return null;
  }
  const content = message.content_text?.trim();
  if (!content) {
    return null;
  }
  return {
    id: message.id,
    role: message.role,
    content,
  };
}

function readStoredConversationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage.getItem(CONVERSATION_STORAGE_KEY);
}

function storeConversationId(conversationId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (conversationId) {
    window.sessionStorage.setItem(CONVERSATION_STORAGE_KEY, conversationId);
  } else {
    window.sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
  }
}

export default function SiteChatWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<EventSource | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    setConversationId(readStoredConversationId());
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isExpanded, scrollToBottom]);

  useEffect(() => {
    return () => {
      streamRef.current?.close();
    };
  }, []);

  const loadConversation = useCallback(async (targetConversationId: string) => {
    setLoadingHistory(true);
    setError(null);
    setAuthRequired(false);
    try {
      const result = await listChatConversationMessages(targetConversationId);
      const history = result.messages
        .map(toDisplayMessage)
        .filter((message): message is DisplayMessage => message !== null);
      setConversationId(result.conversation.id);
      storeConversationId(result.conversation.id);
      setMessages(history);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        setAuthRequired(true);
        setMessages([]);
        return;
      }
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load conversation.";
      setError(message);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const bootstrapConversation = useCallback(async () => {
    const storedId = readStoredConversationId();
    if (storedId) {
      await loadConversation(storedId);
      return;
    }

    setLoadingHistory(true);
    setError(null);
    setAuthRequired(false);
    try {
      const result = await listChatConversations();
      const latest = result.conversations[0];
      if (latest) {
        await loadConversation(latest.id);
      }
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 401) {
        setAuthRequired(true);
        return;
      }
      const message =
        caught instanceof ApiRequestError
          ? caught.message
          : "Failed to load conversations.";
      setError(message);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadConversation]);

  useEffect(() => {
    if (!isExpanded || loadingHistory) {
      return;
    }
    if (messages.length > 0) {
      return;
    }
    void bootstrapConversation();
  }, [isExpanded, messages.length, loadingHistory, bootstrapConversation]);

  function startNewConversation() {
    streamRef.current?.close();
    streamRef.current = null;
    setConversationId(null);
    storeConversationId(null);
    setMessages([]);
    setStreamingContent("");
    setIsStreaming(false);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending || isStreaming) {
      return;
    }

    setIsSending(true);
    setError(null);
    setAuthRequired(false);
    setInput("");

    const optimisticUserMessage: DisplayMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((previous) => [...previous, optimisticUserMessage]);

    try {
      const result = await postChatMessage({
        text: trimmed,
        conversationId,
        attachmentIds: [],
      });

      setConversationId(result.conversationId);
      storeConversationId(result.conversationId);

      setIsStreaming(true);
      setStreamingContent("");

      streamRef.current?.close();
      streamRef.current = openChatStream(
        result.sessionId,
        (token) => {
          setStreamingContent((previous) => previous + token);
        },
        () => {
          setStreamingContent((finalContent) => {
            if (finalContent.trim()) {
              setMessages((previous) => [
                ...previous,
                {
                  id: `local-assistant-${Date.now()}`,
                  role: "assistant",
                  content: finalContent,
                },
              ]);
            }
            return "";
          });
          setIsStreaming(false);
          setIsSending(false);
          streamRef.current = null;
        },
        () => {
          setIsStreaming(false);
          setIsSending(false);
          setError("Chat stream interrupted. Try sending again.");
          streamRef.current = null;
        },
      );
    } catch (caught) {
      setMessages((previous) =>
        previous.filter((message) => message.id !== optimisticUserMessage.id),
      );
      setInput(trimmed);
      if (caught instanceof ApiRequestError && caught.status === 401) {
        setAuthRequired(true);
      } else {
        const message =
          caught instanceof ApiRequestError
            ? caught.message
            : "Failed to send message.";
        setError(message);
      }
      setIsSending(false);
      setIsStreaming(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  function toggleExpanded() {
    setIsExpanded((previous) => !previous);
    if (!isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div
      className={isExpanded ? "site-chat site-chat--expanded" : "site-chat"}
      aria-label="Job search assistant chat"
    >
      <div className="site-chat__header">
        <button
          type="button"
          className="site-chat__toggle"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-controls="site-chat-panel"
        >
          <span className="site-chat__title">Job Search Assistant</span>
          <span className="site-chat__toggle-label">
            {isExpanded ? "Minimize" : "Open chat"}
          </span>
        </button>
        {isExpanded ? (
          <button
            type="button"
            className="site-chat__new-chat"
            onClick={startNewConversation}
            disabled={isSending || isStreaming}
          >
            New chat
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <div id="site-chat-panel" className="site-chat__panel">
          {authRequired ? (
            <p className="site-chat__notice">
              Sign in to use the assistant.{" "}
              <a href="/auth/login">Log in</a>
            </p>
          ) : null}

          {error ? (
            <div className="site-chat__error" role="alert">
              {error}
            </div>
          ) : null}

          <div
            className="site-chat__messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {loadingHistory ? (
              <p className="site-chat__notice">Loading conversation…</p>
            ) : null}

            {!loadingHistory && messages.length === 0 && !authRequired ? (
              <div className="site-chat__empty">
                <p>Ask about your profile, jobs, skills, or interview prep.</p>
                <div className="site-chat__chips">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="site-chat__chip"
                      disabled={isSending || isStreaming}
                      onClick={() => void sendMessage(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "site-chat__bubble site-chat__bubble--user"
                    : "site-chat__bubble site-chat__bubble--assistant"
                }
              >
                {message.role === "assistant" ? (
                  <Markdown>{message.content}</Markdown>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            ))}

            {isStreaming && streamingContent ? (
              <div className="site-chat__bubble site-chat__bubble--assistant site-chat__bubble--streaming">
                <Markdown>{streamingContent}</Markdown>
                <span className="site-chat__cursor" aria-hidden="true" />
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form className="site-chat__composer" onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder={
                authRequired
                  ? "Sign in to chat…"
                  : "Ask the assistant… (Enter to send, Shift+Enter for newline)"
              }
              rows={2}
              disabled={authRequired || isSending || isStreaming}
            />
            <button
              type="submit"
              disabled={
                authRequired || isSending || isStreaming || !input.trim()
              }
            >
              {isSending || isStreaming ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
