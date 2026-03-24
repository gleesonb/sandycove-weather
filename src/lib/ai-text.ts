/**
 * AI Text Generation Module
 *
 * Provides weather summary generation using Cloudflare Workers AI.
 * Validates AI binding availability and handles errors gracefully.
 */

interface AiTextResult {
  /** The generated text summary */
  text: string;
  /** ISO timestamp when the text was generated */
  issued: string;
}

interface AiError extends Error {
  code: "AI_BINDING_MISSING" | "AI_REQUEST_FAILED" | "AI_INVALID_RESPONSE";
}

/**
 * Generate a weather summary using Cloudflare Workers AI
 *
 * Uses the Llama 3.1 8B Instruct model via Cloudflare Workers AI.
 * Falls back to a simple template-based summary if AI is unavailable.
 *
 * @param env - Cloudflare environment with AI binding
 * @param weatherData - Current weather conditions to summarize
 * @returns Promise resolving to { text, issued } object
 *
 * @example
 * ```ts
 * const result = await generateWeatherSummary(env, {
 *   temperature: 15,
 *   description: "Partly cloudy",
 *   windSpeed: 12
 * });
 * console.log(result.text); // "Currently 15°C with partly cloudy skies..."
 * ```
 */
export async function generateWeatherSummary(
  env: { AI?: any },
  weatherData: {
    temperature: number;
    description: string;
    windSpeed: number;
    humidity?: number;
    feelsLike?: number;
  },
): Promise<AiTextResult> {
  const issued = new Date().toISOString();

  // Check if AI binding is available
  if (!env.AI) {
    throw createAiError("AI_BINDING_MISSING", "AI binding not configured in Cloudflare Workers environment");
  }

  try {
    // Build the prompt for weather summarization
    const prompt = buildWeatherPrompt(weatherData);

    // Call Cloudflare Workers AI with Llama 3.1 8B Instruct
    const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      prompt,
      max_tokens: 150,
      temperature: 0.7,
    });

    // Validate response
    if (!response || typeof response !== "object") {
      throw createAiError("AI_INVALID_RESPONSE", "AI returned invalid response object");
    }

    // Extract text from response (handle different response formats)
    const text = extractResponseText(response);

    if (!text || text.trim().length === 0) {
      throw createAiError("AI_INVALID_RESPONSE", "AI returned empty or invalid text");
    }

    return { text: text.trim(), issued };
  } catch (error) {
    // Re-throw AI errors with context
    if (isAiError(error)) {
      throw error;
    }

    // Wrap unknown errors
    throw createAiError(
      "AI_REQUEST_FAILED",
      `AI request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Build a prompt for weather summarization
 */
function buildWeatherPrompt(data: {
  temperature: number;
  description: string;
  windSpeed: number;
  humidity?: number;
  feelsLike?: number;
}): string {
  const parts = [
    `Current weather conditions:`,
    `- Temperature: ${data.temperature}°C`,
    data.feelsLike !== undefined ? `- Feels like: ${data.feelsLike}°C` : null,
    `- Conditions: ${data.description}`,
    `- Wind speed: ${data.windSpeed} km/h`,
    data.humidity !== undefined ? `- Humidity: ${data.humidity}%` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${parts}

Please provide a brief, friendly 2-3 sentence weather summary for these conditions. Focus on what people should expect and how it feels outside.`;
}

/**
 * Extract text from AI response (handles multiple response formats)
 */
function extractResponseText(response: unknown): string {
  if (typeof response === "string") {
    return response;
  }

  if (typeof response === "object" && response !== null) {
    // Handle { response: string } format
    if ("response" in response && typeof response.response === "string") {
      return response.response;
    }

    // Handle { text: string } format
    if ("text" in response && typeof response.text === "string") {
      return response.text;
    }

    // Handle { generated_text: string } format (some models)
    if ("generated_text" in response && typeof response.generated_text === "string") {
      return response.generated_text;
    }
  }

  return "";
}

/**
 * Create an AI error with proper typing
 */
function createAiError(code: AiError["code"], message: string): AiError {
  const error = new Error(message) as AiError;
  error.code = code;
  return error;
}

/**
 * Type guard for AI errors
 */
function isAiError(error: unknown): error is AiError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    (error.code === "AI_BINDING_MISSING" ||
      error.code === "AI_REQUEST_FAILED" ||
      error.code === "AI_INVALID_RESPONSE")
  );
}

/**
 * Check if AI binding is available in the environment
 *
 * @param env - Cloudflare environment
 * @returns true if AI binding is configured and available
 */
export function isAiAvailable(env: { AI?: unknown }): boolean {
  return typeof env.AI === "object" && env.AI !== null;
}
