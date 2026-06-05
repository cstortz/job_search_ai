import "server-only";

type ChatRole = "user" | "assistant" | "system";

export interface LlmInputMessage {
  role: ChatRole;
  content: string;
}

export interface LlmGenerateTextInput {
  messages: LlmInputMessage[];
}

export interface LlmGenerateTextResult {
  text: string;
  provider: string;
  model: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface LlmProvider {
  generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult>;
}

export class LlmConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigurationError";
  }
}

export class LlmProviderRequestError extends Error {
  provider: string;
  status?: number;

  constructor(provider: string, message: string, status?: number) {
    super(message);
    this.name = "LlmProviderRequestError";
    this.provider = provider;
    this.status = status;
  }
}

function ensureApiKey(value: string | undefined, envName: string): string {
  if (!value || !value.trim()) {
    throw new LlmConfigurationError(`Missing required environment variable: ${envName}`);
  }
  return value.trim();
}

function getLastUserMessage(messages: LlmInputMessage[]): string {
  const reversed = [...messages].reverse();
  const lastUser = reversed.find((message) => message.role === "user");
  return lastUser?.content ?? "No user message provided.";
}

class MockLlmProvider implements LlmProvider {
  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const prompt = getLastUserMessage(input.messages);
    return {
      text: `Persistent chat response: ${prompt}`,
      provider: "mock",
      model: "mock-responder-v1",
    };
  }
}

class AnthropicLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = ensureApiKey(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
    this.model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const body = {
      model: this.model,
      max_tokens: 700,
      messages: input.messages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new LlmProviderRequestError(
        "anthropic",
        `Anthropic request failed (${response.status}): ${text}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      model?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = payload.content
      ?.filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text as string)
      .join("")
      .trim();

    if (!text) {
      throw new Error("Anthropic response did not include text content.");
    }

    const promptTokens = payload.usage?.input_tokens;
    const completionTokens = payload.usage?.output_tokens;
    return {
      text,
      provider: "anthropic",
      model: payload.model ?? this.model,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens:
          typeof promptTokens === "number" && typeof completionTokens === "number"
            ? promptTokens + completionTokens
            : undefined,
      },
    };
  }
}

class OpenAiLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = ensureApiKey(process.env.OPENAI_API_KEY, "OPENAI_API_KEY");
    this.model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const body = {
      model: this.model,
      temperature: 0.2,
      messages: input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new LlmProviderRequestError(
        "openai",
        `OpenAI request failed (${response.status}): ${text}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("OpenAI response did not include assistant text.");
    }

    return {
      text,
      provider: "openai",
      model: payload.model ?? this.model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      },
    };
  }
}

class GeminiLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = ensureApiKey(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
    this.model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  }

  async generateText(input: LlmGenerateTextInput): Promise<LlmGenerateTextResult> {
    const contents = input.messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new LlmProviderRequestError(
        "gemini",
        `Gemini request failed (${response.status}): ${text}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error("Gemini response did not include assistant text.");
    }

    return {
      text,
      provider: "gemini",
      model: this.model,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount,
        completionTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount,
      },
    };
  }
}

function createProvider(): LlmProvider {
  const providerName = process.env.LLM_PROVIDER?.trim().toLowerCase() || "mock";
  switch (providerName) {
    case "anthropic":
    case "claude":
      return new AnthropicLlmProvider();
    case "openai":
      return new OpenAiLlmProvider();
    case "gemini":
    case "google":
      return new GeminiLlmProvider();
    case "mock":
      return new MockLlmProvider();
    default:
      throw new LlmConfigurationError(
        `Unsupported LLM_PROVIDER value: ${providerName}. Use one of: mock, anthropic, openai, gemini.`,
      );
  }
}

const provider = createProvider();

export async function generateAssistantText(
  input: LlmGenerateTextInput,
): Promise<LlmGenerateTextResult> {
  return provider.generateText(input);
}
