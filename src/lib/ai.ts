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
						"Generate clear, concise weather summaries in a friendly, informative tone. " +
						"Focus on key information like temperature ranges, precipitation chances, " +
						"wind conditions, and any notable changes. Keep responses under 150 words.",
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

	prompt += `\nPlease provide a clear, concise forecast summary (under 150 words) that highlights the key information and any important weather trends.`;

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

	let forecast = `Weather for Sandycove, Dublin:\n\n`;
	forecast += `Today: ${todayDaily?.description || "Variable conditions"}. `;
	forecast += `Temperature around ${avgTemp.toFixed(1)}°C (${todayDaily?.tempLow.toFixed(1)}°C to ${todayDaily?.tempHigh.toFixed(1)}°C). `;

	if (maxPrecipProb > 50) {
		forecast += `Rain likely (${maxPrecipProb.toFixed(0)}% chance). `;
	} else if (maxPrecipProb > 20) {
		forecast += `Possible showers (${maxPrecipProb.toFixed(0)}% chance). `;
	} else {
		forecast += `Precipitation unlikely. `;
	}

	forecast += `Winds ${avgWind.toFixed(1)} km/h.\n`;

	if (tomorrowDaily) {
		forecast += `\nTomorrow: ${tomorrowDaily.description}. `;
		forecast += `${tomorrowDaily.tempLow.toFixed(1)}°C to ${tomorrowDaily.tempHigh.toFixed(1)}°C. `;

		if (tomorrowDaily.precipProbability > 50) {
			forecast += `Rain expected (${tomorrowDaily.precipProbability.toFixed(0)}% chance). `;
		}

		forecast += `Winds ${tomorrowDaily.windSpeed.toFixed(1)} km/h.`;
	}

	return forecast;
}
