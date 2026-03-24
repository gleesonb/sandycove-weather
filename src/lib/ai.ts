/** AI text generation utilities using Cloudflare Workers AI */

import { env } from "cloudflare:workers";
import { isAiAvailable } from "./ai-text";

interface TextGenerationOptions {
	/**
	 * Maximum number of tokens to generate
	 */
	maxTokens?: number;

	/**
	 * Temperature for sampling (0-1)
	 * Lower = more focused, Higher = more creative
	 */
	temperature?: number;

	/**
	 * Stop sequences to end generation
	 */
	stopSequences?: string[];
}

/**
 * Generate a weather forecast summary using AI
 *
 * @param forecastData - Hourly and daily forecast data
 * @param options - Generation options
 * @returns Generated text forecast
 */
export async function generateWeatherForecast(
	forecastData: {
		hourly: Array<{
			timestamp: string;
			temperature: number;
			description: string;
			windSpeed: number;
			precipitation: number;
			precipProbability: number;
		}>;
		daily: Array<{
			date: string;
			tempHigh: number;
			tempLow: number;
			description: string;
			precipitation: number;
			precipProbability: number;
			windSpeed: number;
		}>;
	},
	options: TextGenerationOptions = {},
): Promise<string> {
	const { maxTokens = 500, temperature = 0.7 } = options;

	// Build a structured summary of the forecast data
	const prompt = buildForecastPrompt(forecastData);

	try {
		// Check if AI binding is available
		if (!isAiAvailable(env)) {
			console.warn("AI binding not available, using fallback forecast");
			return generateFallbackForecast(forecastData);
		}

		// Use Cloudflare Workers AI with a text generation model
		// @ts-ignore - AI binding is defined in wrangler.toml and env.d.ts
		const ai = env.AI;

		const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content:
						"You are a helpful weather assistant for Sandycove, Dublin, Ireland. " +
						"Generate clear, conversational weather summaries that are easy to read. " +
						"\n\n" +
						"FORMAT REQUIREMENTS:\n" +
						"- Start with 'Today' followed by a concise summary\n" +
						"- Add a blank line, then 'Tomorrow' section\n" +
						"- Use clear paragraph breaks between sections\n" +
						"- Keep each section focused and scannable\n" +
						"- Use conversational language but stay informative\n" +
						"- Keep total response under 150 words\n" +
						"- Highlight important weather changes (rain, wind, temp drops)\n" +
						"\n" +
						"Example structure:\n" +
						"Today will be [conditions] with [details]. [Additional info].\n" +
						"\n" +
						"Tomorrow expects [conditions]. [Key details].\n\n" +
						"Focus on what matters: temperature ranges, precipitation chances, " +
						"wind conditions, and any notable changes.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			max_tokens: maxTokens,
			temperature,
		});

		// Extract the generated text
		const generatedText =
			// @ts-ignore - response structure varies by model
			response?.response ||
			// @ts-ignore
			response?.text?.() ||
			// @ts-ignore
			response?.generated_text ||
			"";

		if (!generatedText || typeof generatedText !== "string") {
			throw new Error("Invalid AI response format");
		}

		return generatedText.trim();
	} catch (error) {
		// Log error but return fallback
		console.error("AI text generation failed:", error);
		return generateFallbackForecast(forecastData);
	}
}

/**
 * Build a structured prompt from forecast data
 */
function buildForecastPrompt(forecastData: {
	hourly: Array<{
		timestamp: string;
		temperature: number;
		description: string;
		windSpeed: number;
		precipitation: number;
		precipProbability: number;
	}>;
	daily: Array<{
		date: string;
		tempHigh: number;
		tempLow: number;
		description: string;
		precipitation: number;
		precipProbability: number;
		windSpeed: number;
	}>;
}): string {
	const today = new Date().toISOString().split("T")[0];
	const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

	// Get today's hourly forecast (next 24 hours)
	const todayHourly = forecastData.hourly
		.filter((h) => h.timestamp.startsWith(today))
		.slice(0, 8); // Next 24 hours (3-hour intervals)

	const avgTemp =
		todayHourly.reduce((sum, h) => sum + h.temperature, 0) / todayHourly.length;
	const maxPrecipProb = Math.max(...todayHourly.map((h) => h.precipProbability));
	const avgWind = todayHourly.reduce((sum, h) => sum + h.windSpeed, 0) / todayHourly.length;

	// Get daily conditions
	const todayDaily = forecastData.daily.find((d) => d.date === today);
	const tomorrowDaily = forecastData.daily.find((d) => d.date === tomorrow);

	let prompt = `Generate a weather forecast summary for Sandycove, Dublin based on the following data:\n\n`;

	prompt += `**Today (${today}):**\n`;
	prompt += `- Average temperature: ${avgTemp.toFixed(1)}°C\n`;
	prompt += `- Conditions: ${todayDaily?.description || "Variable"}\n`;
	prompt += `- High/Low: ${todayDaily?.tempHigh.toFixed(1)}°C / ${todayDaily?.tempLow.toFixed(1)}°C\n`;
	prompt += `- Precipitation chance: ${maxPrecipProb.toFixed(0)}%\n`;
	prompt += `- Wind: ${avgWind.toFixed(1)} km/h\n`;

	if (tomorrowDaily) {
		prompt += `\n**Tomorrow (${tomorrow}):**\n`;
		prompt += `- Conditions: ${tomorrowDaily.description}\n`;
		prompt += `- High/Low: ${tomorrowDaily.tempHigh.toFixed(1)}°C / ${tomorrowDaily.tempLow.toFixed(1)}°C\n`;
		prompt += `- Precipitation chance: ${tomorrowDaily.precipProbability.toFixed(0)}%\n`;
		prompt += `- Wind: ${tomorrowDaily.windSpeed.toFixed(1)} km/h\n`;
	}

	prompt += `\nProvide a well-structured forecast (under 150 words):\n\n`;
	prompt += `1. Start with "Today" and describe today's weather\n`;
	prompt += `2. Add a blank line\n`;
	prompt += `3. Start with "Tomorrow" and describe tomorrow's weather\n`;
	prompt += `4. Keep each section concise and conversational\n`;
	prompt += `5. Highlight important changes (rain, wind, temperature)\n\n`;
	prompt += `Use natural language like "Today will be partly cloudy with a high of 15°C..."`;

	return prompt;
}

/**
 * Generate a simple fallback forecast when AI is unavailable
 */
function generateFallbackForecast(forecastData: {
	hourly: Array<{
		timestamp: string;
		temperature: number;
		description: string;
		windSpeed: number;
		precipitation: number;
		precipProbability: number;
	}>;
	daily: Array<{
		date: string;
		tempHigh: number;
		tempLow: number;
		description: string;
		precipitation: number;
		precipProbability: number;
		windSpeed: number;
	}>;
}): string {
	const today = new Date().toISOString().split("T")[0];
	const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

	const todayHourly = forecastData.hourly
		.filter((h) => h.timestamp.startsWith(today))
		.slice(0, 8);

	const avgTemp =
		todayHourly.reduce((sum, h) => sum + h.temperature, 0) / todayHourly.length;
	const maxPrecipProb = Math.max(...todayHourly.map((h) => h.precipProbability));
	const avgWind = todayHourly.reduce((sum, h) => sum + h.windSpeed, 0) / todayHourly.length;

	const todayDaily = forecastData.daily.find((d) => d.date === today);
	const tomorrowDaily = forecastData.daily.find((d) => d.date === tomorrow);

	let forecast = `Today will be ${todayDaily?.description?.toLowerCase() || "variable conditions"}. `;
	forecast += `Temperatures will range from ${todayDaily?.tempLow.toFixed(1)}°C to ${todayDaily?.tempHigh.toFixed(1)}°C, `;
	forecast += `averaging around ${avgTemp.toFixed(1)}°C. `;

	if (maxPrecipProb > 50) {
		forecast += `Rain is likely (${maxPrecipProb.toFixed(0)}% chance). `;
	} else if (maxPrecipProb > 20) {
		forecast += `There's a chance of showers (${maxPrecipProb.toFixed(0)}%). `;
	} else {
		forecast += `Precipitation is unlikely. `;
	}

	forecast += `Winds will be around ${avgWind.toFixed(1)} km/h.\n`;

	if (tomorrowDaily) {
		forecast += `\nTomorrow expects ${tomorrowDaily.description.toLowerCase()}. `;
		forecast += `Temperatures between ${tomorrowDaily.tempLow.toFixed(1)}°C and ${tomorrowDaily.tempHigh.toFixed(1)}°C. `;

		if (tomorrowDaily.precipProbability > 50) {
			forecast += `Rain expected (${tomorrowDaily.precipProbability.toFixed(0)}% chance). `;
		}

		forecast += `Winds around ${tomorrowDaily.windSpeed.toFixed(1)} km/h.`;
	}

	return forecast;
}
