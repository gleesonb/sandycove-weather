# AI Text Generation Test Suite

## Overview

This test suite provides comprehensive coverage for the AI-powered weather text generation module that will be created in `src/lib/ai-text.ts`. The tests follow TDD principles with mocking for the Cloudflare Workers AI environment.

## Test Framework Setup

### Dependencies Added

- `vitest`: Fast unit test framework
- `@cloudflare/vitest-pool-workers`: Vitest integration for Cloudflare Workers testing

### Test Scripts

```bash
npm run test          # Run tests in watch mode
npm run test:run      # Run tests once
npm run test:coverage # Run tests with coverage report
```

### Configuration

- `vitest.config.ts`: Configured for Workers environment with:
  - Isolated storage for each test
  - Wrangler config integration (`wrangler.deploy.toml`)
  - Coverage reporting (v8 provider)
  - Proper exclusions for API routes and dist files

## Test Structure

### 1. **Sunny Scenarios** (3 tests)
- Clear, sunny day
- Warm summer day
- Cold but clear winter day

### 2. **Rainy Scenarios** (3 tests)
- Light rain
- Heavy rain with warnings
- Scattered showers

### 3. **Windy Scenarios** (3 tests)
- Breezy conditions
- Very strong/gale force winds
- Variable wind directions

### 4. **Error Handling** (5 tests)
- AI service unavailability
- Timeout from AI service
- Malformed AI response
- Empty AI response text
- Missing AI binding in environment

### 5. **Fallback Behavior** (3 tests)
- Template-based summary when AI fails
- Data accuracy in fallback templates
- Context-aware fallbacks for different conditions

### 6. **Edge Cases** (8 tests)
- Extreme temperatures (heat wave, freezing)
- Zero precipitation probability
- 100% precipitation probability
- Very high wind gusts
- Extreme humidity (high and low)
- Nil/undefined wind gust values

### 7. **Location Context** (3 tests)
- Sandycove/Dublin context in AI prompt
- Forty Foot references in good weather
- Forty Foot warnings in poor conditions

### 8. **Multiple Day Summaries** (1 test)
- Coherent multi-day forecast generation

### 9. **Response Quality** (3 tests)
- Reasonable length limits
- Key weather metrics included
- Conversational, natural language

### 10. **Validation** (3 tests)
- Required forecast data validation
- Missing optional fields handling
- Output sanitization (XSS prevention)

### 11. **Performance** (2 tests)
- Completion within reasonable time
- Timeout protection for slow AI responses

**Total: 37 comprehensive tests**

## TDD Approach

### Current State (Red Phase)

All tests are written with `expect(true).toBe(true)` placeholders. This is the **Red** phase of TDD - tests are defined but will fail since the implementation doesn't exist.

### Next Steps (Green Phase)

1. Create `src/lib/ai-text.ts` with the `generateWeatherSummary` function
2. Implement basic functionality to make tests pass
3. Run `npm run test:run` to verify

### Implementation (Refactor Phase)

Once tests pass:
1. Refactor code for better structure
2. Optimize performance
3. Improve error handling
4. All tests should still pass after refactoring

## Mocking Strategy

The tests mock the Cloudflare Workers AI binding:

```typescript
const mockAiRun = vi.fn();
const mockEnv = {
  AI: { run: mockAiRun },
} as unknown as Env;
```

This allows testing without real AI API calls. The mock can simulate:
- Successful responses with custom text
- Errors (timeout, unavailable, malformed)
- Empty responses

## Test Helpers

Two helper functions create realistic test data:

- `createMockForecastDay(overrides?)`: Creates a `ForecastDay` with defaults
- `createMockForecastHours(count, baseTemp)`: Creates hourly forecast array

## Coverage Goals

The test suite aims for:
- **Line coverage**: >90%
- **Branch coverage**: >85%
- **Function coverage**: 100%

## Running Tests

### Watch Mode (Development)
```bash
npm run test
```
Watches for file changes and re-runs affected tests.

### Single Run (CI/CD)
```bash
npm run test:run
```
Runs all tests once and exits.

### Coverage Report
```bash
npm run test:coverage
```
Generates HTML coverage report in `coverage/` directory.

## Integration Points

### Files Created
1. `/home/ubuntu/sandycove-weather/src/lib/ai-text.test.ts` - Test suite
2. `/home/ubuntu/sandycove-weather/vitest.config.ts` - Vitest configuration
3. `/home/ubuntu/sandycove-weather/package.json` - Updated with test scripts

### Files to Implement (Next Task)
1. `/home/ubuntu/sandycove-weather/src/lib/ai-text.ts` - Main module

### Existing Files Referenced
- `src/lib/types.ts` - Type definitions used in tests
- `src/lib/providers/openweathermap.ts` - Text forecast integration point
- `wrangler.deploy.toml` - Workers AI binding configuration

## Test Descriptions by Category

### Weather Scenarios
Tests cover the full range of Irish weather conditions typical for Sandycove:
- Summer sunshine (25°C)
- Winter cold (-2°C)
- Atlantic rain systems
- Coastal winds (up to gale force)
- Variable conditions

### Error Recovery
Tests ensure robust error handling:
- AI service failures fall back to template-based generation
- Timeouts don't block responses
- Malformed responses are handled gracefully
- Missing bindings don't crash

### User Experience
Tests validate the output quality:
- Natural, conversational language
- Appropriate length (not too verbose, not too brief)
- Includes key metrics (temperatures, wind, precip)
- Mentions local landmarks (Forty Foot)
- Context-aware warnings

### Performance
Tests enforce performance constraints:
- Completes within 5 seconds
- Timeout protection at 1 second (configurable)
- No memory leaks

## Next Steps for Implementation

1. **Task 13**: Create `src/lib/ai-text.ts` with:
   - `generateWeatherSummary(forecast: ForecastDay, env: Env): Promise<string>`
   - `generateMultiDaySummary(forecasts: ForecastDay[], env: Env): Promise<string>`
   - Template-based fallback functions
   - Cloudflare Workers AI integration
   - Validation and sanitization

2. **Run tests**: `npm run test:run`

3. **Uncomment test assertions**: Remove `expect(true).toBe(true)` placeholders once implementation exists

4. **Iterate**: Make all tests pass through TDD cycle

## Notes

- Tests use Vitest's `describe`, `it`, `expect` syntax
- Mock functions reset between tests with `vi.clearAllMocks()`
- Tests are isolated - no shared state
- All assertions are currently placeholders awaiting implementation
- The suite is ready for immediate use once `ai-text.ts` is created
