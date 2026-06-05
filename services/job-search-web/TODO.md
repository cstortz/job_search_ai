# TODO

## Chat/LLM hardening follow-ups

- Add request timeout and retry policy for LLM provider calls.
- Add token/usage and estimated cost logging per assistant message.
- Add fallback model/provider behavior (primary -> secondary) on transient failures.
- Add rate limiting for chat endpoints (`/api/chat/message`, `/api/chat/stream/{sessionId}`).
