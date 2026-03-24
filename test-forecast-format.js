/**
 * Manual test script to verify AI forecast formatting
 *
 * This simulates the forecast data structure to show the expected output format.
 */

function buildForecastPrompt(forecastData) {
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

function generateFallbackForecast(forecastData) {
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

// Example usage
const mockData = {
	hourly: Array.from({ length: 24 }, (_, i) => ({
		timestamp: new Date(Date.now() + i * 3600000).toISOString(),
		temperature: 12 + i * 0.3,
		description: "Partly cloudy",
		windSpeed: 15,
		precipitation: 0,
		precipProbability: 10 + i * 2,
	})),
	daily: [
		{
			date: new Date().toISOString().split("T")[0],
			tempHigh: 15,
			tempLow: 10,
			description: "Partly cloudy",
			precipitation: 0,
			precipProbability: 20,
			windSpeed: 18,
		},
		{
			date: new Date(Date.now() + 86400000).toISOString().split("T")[0],
			tempHigh: 14,
			tempLow: 9,
			description: "Light rain",
			precipitation: 2,
			precipProbability: 60,
			windSpeed: 22,
		},
	],
};

console.log("=== AI Prompt (input to LLM) ===\n");
console.log(buildForecastPrompt(mockData));

console.log("\n\n=== Fallback Forecast (when AI unavailable) ===\n");
console.log(generateFallbackForecast(mockData));

console.log("\n\n=== Expected AI Output Structure ===\n");
console.log(`Today will be partly cloudy with temperatures ranging from 10°C to 15°C, averaging around 12.5°C. There's a slight chance of showers (20%). Winds will be around 18 km/h.

Tomorrow expects light rain. Temperatures between 9°C and 14°C. Rain expected (60% chance). Winds around 22 km/h.`);
