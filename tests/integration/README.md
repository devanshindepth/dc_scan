# Integration Tests for AI Development Insights System

This directory contains comprehensive integration tests that validate the complete end-to-end workflow of the AI Development Insights system, from VS Code extension event collection through backend processing to insight generation.

## Overview

The integration test suite covers:

- **End-to-End Workflows**: Complete developer sessions with AI assistance
- **Multi-Component Interactions**: VS Code extension ↔ Motia backend communication
- **Realistic Developer Scenarios**: Coding sessions, debugging workflows, AI tool usage
- **Privacy Protection Validation**: Ensuring no sensitive data leakage
- **Performance Testing**: High-volume event processing
- **Error Handling**: System resilience under various failure conditions
- **Data Retention**: Storage management and cleanup procedures

## Test Structure

```
tests/integration/
├── README.md                    # This file
├── integration.test.ts          # Main integration test suite
├── end-to-end.test.ts          # Comprehensive E2E scenarios
├── test-helpers.ts             # Utilities for generating test data
├── run-integration-tests.ts    # Test runner with backend orchestration
├── mocha.opts                  # Mocha configuration
└── logs/                       # Test execution logs and reports
```

## Running Tests

### Prerequisites

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Project**:
   ```bash
   npm run build
   ```

### Running Integration Tests

#### Option 1: Using npm scripts (Recommended)
```bash
# Run all integration tests
npm run test:integration

# Run tests in watch mode
npm run test:integration:watch

# Run all tests (includes integration)
npm run test:all
```

#### Option 2: Using the test runner directly
```bash
# Run with default configuration
npx ts-node tests/integration/run-integration-tests.ts

# Run with custom port
npx ts-node tests/integration/run-integration-tests.ts --port 3002

# Run with extended timeout (in seconds)
npx ts-node tests/integration/run-integration-tests.ts --timeout 120

# Run without cleanup (for debugging)
npx ts-node tests/integration/run-integration-tests.ts --no-cleanup
```

#### Option 3: Using Mocha directly
```bash
# Run specific test file
npx mocha --opts tests/integration/mocha.opts tests/integration/end-to-end.test.ts

# Run with specific grep pattern
npx mocha --opts tests/integration/mocha.opts --grep "Privacy Protection"
```

## Test Categories

### 1. End-to-End Workflow Tests

**File**: `end-to-end.test.ts`

Tests complete developer workflows including:
- Coding sessions with AI assistance
- Multi-day activity analysis
- Privacy protection validation
- Edge case handling
- Performance validation
- Data retention and cleanup

### 2. Integration Tests

**File**: `integration.test.ts`

Tests system integration scenarios:
- Backend server startup and health checks
- Event ingestion and processing
- Offline-to-online synchronization
- Multi-component interaction validation
- Error recovery and resilience

### 3. Property-Based Tests

Both test files include property-based tests using `fast-check` that validate:
- Data integrity throughout the processing pipeline
- Privacy protection across all event types
- Consistency of heuristic measurements
- System behavior under random inputs

## Test Data Generation

The `test-helpers.ts` file provides utilities for generating realistic test data:

### Realistic Developer Sessions
```typescript
const config: RealisticScenarioConfig = {
    developerId: 'test-developer',
    sessionDuration: 2 * 60 * 60 * 1000, // 2 hours
    aiUsageFrequency: 'medium',
    debuggingStyle: 'hypothesis-driven',
    errorFrequency: 2 // errors per hour
};

const { events, expectedMetrics } = generateRealisticCodingSession(config);
```

### Multi-Day Activity
```typescript
const events = generateMultiDayActivity('developer-id', 7); // 7 days of activity
```

### Edge Cases
```typescript
const edgeCases = generateEdgeCaseScenarios('developer-id');
```

### Performance Testing
```typescript
const perfEvents = generatePerformanceTestDataset('developer-id', 1000); // 1000 events
```

## Configuration

### Environment Variables

The tests use the following environment variables:

- `NODE_ENV=test` - Sets test environment
- `PORT=3001` - Backend server port (configurable)
- `DATABASE_PATH` - Path to test database
- `LOG_LEVEL=error` - Reduces log noise during tests

### Test Configuration

Tests can be configured via the `TestRunnerConfig`:

```typescript
interface TestRunnerConfig {
    backendPort: number;      // Default: 3001
    testTimeout: number;      // Default: 60000ms
    maxRetries: number;       // Default: 3
    cleanupOnExit: boolean;   // Default: true
}
```

## Test Reports

Test execution generates detailed reports:

### Console Output
- Real-time test progress
- Pass/fail counts
- Success rate percentage
- Error summaries

### JSON Reports
Detailed reports are saved to `tests/integration/logs/`:
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "passed": 15,
    "failed": 0,
    "skipped": 2,
    "errors": []
  },
  "config": { ... },
  "successRate": 88.2
}
```

## Debugging Tests

### Running Individual Tests
```bash
# Run specific test suite
npx mocha --opts tests/integration/mocha.opts --grep "Privacy Protection"

# Run with debug output
DEBUG=* npx mocha --opts tests/integration/mocha.opts
```

### Preserving Test Data
```bash
# Run without cleanup to inspect test data
npx ts-node tests/integration/run-integration-tests.ts --no-cleanup
```

### Verbose Logging
Set `LOG_LEVEL=debug` to see detailed backend logs during tests.

## Continuous Integration

For CI/CD pipelines, use:

```bash
# Run tests with timeout and proper exit codes
npm run test:integration
```

The test runner returns appropriate exit codes:
- `0` - All tests passed
- `1` - Some tests failed or runner error

## Troubleshooting

### Common Issues

1. **Backend Startup Timeout**
   - Increase timeout: `--timeout 120`
   - Check port availability
   - Verify dependencies are installed

2. **Database Connection Errors**
   - Ensure write permissions in test directory
   - Check disk space
   - Verify SQLite installation

3. **Memory Issues with Large Tests**
   - Reduce batch sizes in performance tests
   - Increase Node.js memory limit: `--max-old-space-size=4096`

4. **Port Conflicts**
   - Use custom port: `--port 3002`
   - Check for running services on default port

### Getting Help

If tests fail consistently:

1. Check the detailed JSON report in `tests/integration/logs/`
2. Run with `--no-cleanup` to inspect test data
3. Enable debug logging with `LOG_LEVEL=debug`
4. Run individual test files to isolate issues

## Contributing

When adding new integration tests:

1. Follow the existing test structure and naming conventions
2. Use the test helpers for generating realistic data
3. Include both positive and negative test cases
4. Add property-based tests for complex scenarios
5. Update this README with new test categories or configurations

## Requirements Validation

These integration tests validate all requirements from the specification:

- **Requirements 1.x**: AI tool usage pattern tracking and analysis
- **Requirements 2.x**: Debugging effectiveness insights
- **Requirements 3.x**: Privacy and security protection
- **Requirements 4.x**: Offline-first architecture and sync
- **Requirements 5.x**: Backend event processing and aggregation
- **Requirements 6.x**: Ethical operation and data retention
- **Requirements 7.x**: VS Code extension event tracking
- **Requirements 8.x**: Skill inference and insight generation

Each test includes comments indicating which requirements it validates.