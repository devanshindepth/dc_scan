# AI Development Insights

A VS Code extension paired with a Motia backend that provides ethical, privacy-safe insights into how developers work with AI tools.

## Project Structure

This repository contains two main components:

### VS Code Extension (`/extension`)
- Client-side component that tracks developer interactions
- Offline-first architecture with local SQLite storage
- Privacy-safe event tracking (metadata only, no source code)

### Motia Backend (`/src`)
- Server-side component for processing and aggregating data
- Event-driven architecture with API, Event, and Cron steps
- Skill inference and insights generation

## Development

### Backend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate types
npm run generate-types
```

### Extension Development
```bash
# Navigate to extension directory
cd extension

# Install dependencies
npm install

# Build extension
npm run build

# Run tests
npm test
```

## Architecture

The system operates on an offline-first architecture where the VS Code extension tracks developer interactions locally and syncs with the Motia backend when connectivity is available. All data collection is privacy-safe, capturing only metadata and timing information without storing source code, prompts, or responses.