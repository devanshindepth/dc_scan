# AI Development Insights - Development Guide

## Project Structure

This project consists of two main components:

### 1. VS Code Extension (`/extension`)
- **Location**: `./extension/`
- **Purpose**: Client-side tracking of developer interactions
- **Technology**: TypeScript, VS Code Extension API, SQLite
- **Key Features**:
  - Privacy-safe event tracking (metadata only)
  - Offline-first local storage
  - Automatic sync with backend when online
  - User privacy controls

### 2. Motia Backend (`/src`)
- **Location**: `./src/`
- **Purpose**: Server-side event processing and insights generation
- **Technology**: Motia framework, TypeScript, SQLite
- **Key Features**:
  - Event ingestion API
  - Background event processing
  - Daily metrics aggregation
  - Skill inference algorithms

## Development Setup

### Backend Development

```bash
# Install dependencies
npm install

# Generate types
npm run generate-types

# Start development server
npm run dev

# The server will be available at http://localhost:3000
# Workbench UI available at http://localhost:3000
```

### Extension Development

```bash
# Navigate to extension directory
cd extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch
```

### Testing the Extension

1. Open VS Code
2. Press `F5` to launch Extension Development Host
3. The extension will be loaded in the new VS Code window
4. Check the status bar for "AI Insights" indicator
5. Use Command Palette (`Ctrl+Shift+P`) to access extension commands

## Key Components

### VS Code Extension Services

- **EventTracker**: Monitors VS Code events and AI tool interactions
- **LocalStorageManager**: Handles SQLite database operations for local storage
- **SyncManager**: Manages offline-first synchronization with backend
- **HeuristicAnalyzer**: Processes events into privacy-safe insights
- **PrivacyController**: Manages user privacy settings and controls

### Motia Backend Steps

- **EventsIngestion** (API): Receives event batches from extensions
- **ProcessEvents** (Event): Validates and stores events
- **DailyAggregation** (Cron): Generates daily metrics
- **SkillInference** (Event): Analyzes patterns for skill assessments
- **DeveloperInsights** (API): Serves insights to clients
- **Health** (API): Health check endpoint

## Database Schema

### Extension Local Database (SQLite)
```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    metadata TEXT NOT NULL,
    session_id TEXT NOT NULL,
    synced BOOLEAN DEFAULT FALSE,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### Backend Database (SQLite)
- `events`: Raw event storage
- `daily_metrics`: Aggregated daily metrics per developer
- `skill_assessments`: Generated skill assessments and trends

## Privacy & Security

### Data Collection Principles
- ✅ **Collect**: Timing metadata, event counts, file extensions, keystroke burst durations
- ❌ **Never Collect**: Source code, AI prompts/responses, error messages, file paths

### Privacy Features
- Local-first data storage
- User-controlled tracking pause/resume
- Automatic data retention policies
- Transparent data export capabilities
- Heuristic-only analysis (no exact measurements)

## Development Workflow

1. **Requirements**: Defined in `.kiro/specs/ai-dev-insights/requirements.md`
2. **Design**: Detailed in `.kiro/specs/ai-dev-insights/design.md`
3. **Tasks**: Implementation plan in `.kiro/specs/ai-dev-insights/tasks.md`

## Next Steps

This setup provides the foundation for the AI Development Insights system. The next tasks will implement:

1. Core event tracking functionality
2. AI tool integration detection
3. Local storage and sync mechanisms
4. Backend event processing pipeline
5. Skill inference algorithms
6. Insights API endpoints

## Troubleshooting

### Common Issues

1. **Extension won't compile**: Ensure all dependencies are installed with `npm install` in the extension directory
2. **Backend won't start**: Run `npm run generate-types` to ensure all step configurations are valid
3. **Database issues**: Check that the `data/` directory exists and has write permissions

### Useful Commands

```bash
# Backend
npm run generate-types  # Regenerate Motia types
npm run dev             # Start development server
npm run build           # Build for production

# Extension
cd extension
npm run compile         # Compile TypeScript
npm run watch          # Watch for changes
npm run test           # Run tests
```