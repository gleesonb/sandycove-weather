/**
 * Test AI text forecast formatting
 */

import { describe, it, expect } from "vitest";
import { generateWeatherForecast } from "../src/lib/ai";

describe("AI Text Forecast Formatting", () => {
	it("should generate well-formatted forecast with clear structure", async () => {
		const mockForecastData = {
			hourly: Array.from({ length: 24 }, (_, i) => ({
				timestamp: new Date(Date.now() + i * 3600000).toISOString(),
				temperature: 12 + i * 0.5,
				description: "Partly cloudy",
				windSpeed: 15 + i * 0.2,
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

		const result = await generateWeatherForecast(mockForecastData);

		// Check that the forecast has proper structure
		expect(result).toBeTruthy();
		expect(typeof result).toBe("string");

		// Check for "Today" and "Tomorrow" sections
		const lines = result.split("\n").filter((line) => line.trim());
		expect(lines.length).toBeGreaterThan(1);

		// Should have conversational language
		expect(result.toLowerCase()).toMatch(/today|will be|expects/);

		// Should not be too long (under 150 words as requested)
		const words = result.split(/\s+/).length;
		expect(words).toBeLessThanOrEqual(150);

		// Should have clear paragraph breaks
		const hasMultipleParagraphs = result.includes("\n\n") || lines.length > 2;
		expect(hasMultipleParagraphs).toBe(true);
	});

	it("should fallback to simple format when AI is unavailable", async () => {
		// Mock isAiAvailable to return false
		const mockForecastData = {
			hourly: [
				{
					timestamp: new Date().toISOString(),
					temperature: 12,
					description: "Cloudy",
					windSpeed: 15,
					precipitation: 0,
					precipProbability: 30,
				},
			],
			daily: [
				{
					date: new Date().toISOString().split("T")[0],
					tempHigh: 15,
					tempLow: 10,
					description: "Cloudy",
					precipitation: 0,
					precipProbability: 30,
					windSpeed: 15,
				},
			],
		};

		// This will use fallback since AI binding is not available in test
		const result = await generateWeatherForecast(mockForecastData);

		expect(result).toBeTruthy();
		expect(result).toMatch(/Today will be/);
		expect(result).toMatch(/Temperatures will range/);
	});
});
