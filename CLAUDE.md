# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RemoteSQLite is an Electron-based desktop application for managing remote SQLite databases via SSH. The app connects to remote servers through SSH and executes `sqlite3` commands directly on the server without downloading database files locally.

## Development Commands

```bash
# Development
npm run dev                 # Start Vite dev server (browser preview only)
npm run electron:dev        # Start Electron in development mode with hot reload

# Building
npm run build               # Build TypeScript and Vite (outputs to dist/ and dist-electron/)
npm run electron:build      # Build and package for current platform

# Platform-specific packaging
npm run electron:build:win              # Windows (NSIS installer + zip)
npm run electron:build:linux            # Linux (AppImage, deb, rpm, tar.gz)
npm run electron:build:linux:appimage   # Linux AppImage only
npm run electron:build:linux:deb        # Linux deb only
npm run electron:build:mac              # macOS (DMG)

# Linting
npm run lint                # Run ESLint on TypeScript files

# Native module rebuild
npm run postinstall         # Rebuild native modules (ssh2, cpu-features) for Electron
```

## Architecture Overview

### Multi-Process Architecture

The application follows Electron's multi-process model:

**Main Process** (`electron/main.ts`)
- Creates the application window
- Manages system-level IPC handlers
- Initializes services (SSH, SQLite, AI)
- Does NOT have direct access to DOM or browser APIs

**Renderer Process** (`src/` - React app)
- Standard React 18 + TypeScript application
- Communicates with main process through `window.electronAPI` (exposed via preload)
- Uses Zustand for state management

**Preload Script** (`electron/preload.ts`)
- Bridges main and renderer processes securely using `contextBridge`
- Exposes `window.electronAPI` with three namespaces: `ssh`, `sqlite`, `ai`
- Type definitions for the exposed API are in this file

### Service Layer (Main Process)

**SSHService** (`electron/services/sshService.ts`)
- Manages SSH connections using the `ssh2` library
- Maintains a connection pool (Map of active connections)
- Handles authentication: password, private key, SSH Agent
- Provides remote command execution and directory listing

**SQLiteService** (`electron/services/sqliteService.ts`)
- Depends on SSHService for command execution
- Wraps `sqlite3` CLI commands executed on remote servers
- Key methods: `query()`, `execute()`, `getTables()`, `getTableInfo()`, `getIndexes()`
- Uses JSON mode (`sqlite3 -json`) for query results to simplify parsing

### AI Module (Main Process)

The AI assistant is integrated into the main process using LangChain:

**Entry Point** (`electron/ai/index.ts`)
- Initializes the SQLAgent with service dependencies
- Registers IPC handlers for AI operations
- Manages streaming responses via EventEmitter

**SQLAgent** (`electron/ai/agents/sql-agent.ts`)
- LangChain-based ReAct agent for SQL generation and analysis
- Maintains chat sessions with conversation history
- Implements safety classification (SAFE/WARNING/DANGEROUS) for SQL operations
- Stream-based response handling for real-time UI updates

**Tools** (`electron/ai/tools/sql-tools.ts`)
- Six core tools: `get_database_schema`, `get_table_info`, `execute_query`, `execute_dml`, `analyze_data`, `generate_and_execute`
- Tools are registered with the LangChain agent for function calling

**Configuration** (`electron/ai/config/provider-config.ts`)
- Manages AI provider settings (OpenAI or compatible APIs)
- Persists configuration using electron-store

### State Management (Renderer Process)

**Zustand Store** (`src/stores/useAppStore.ts`)
- Single store pattern with persistence middleware
- Persists: `savedConnections`, `savedQueries`, `databases`, `theme`, `fontSize`, `aiConfig`
- Runtime-only state (not persisted): `connectionPool`, `sqlHistory`, `designerTabs`

**Key State Categories:**
- Connection pool: Tracks active SSH connections with status
- Database state: Currently open databases and selected tables
- UI state: Theme, font size, active tabs
- AI state: Configuration and chat sessions

### IPC Communication Pattern

The application uses Electron's `ipcMain`/`ipcRenderer` for cross-process communication:

**From Renderer to Main:**
```typescript
// Renderer
window.electronAPI.sqlite.query(connectionId, dbPath, sql)

// Main (handler registration)
ipcMain.handle('sqlite:query', async (_, connectionId, dbPath, sql) => {
  return sqliteService.query(connectionId, dbPath, sql)
})
```

**Streaming (Main to Renderer):**
The AI module uses EventEmitter pattern for streaming responses:
```typescript
// Main sends chunks
event.reply('ai:stream-chunk', { streamId, chunk })

// Renderer listens via callbacks
window.electronAPI.ai.chatStream(params, { onChunk: (streamId, chunk) => {...} })
```

### Database Schema and Types

Core types are defined in `src/types/index.ts`:

- `SSHConfig`: Connection configuration (auth credentials, jump host)
- `Connection`: Active connection with runtime state (status, timestamps)
- `DatabaseInfo`: Open database with path and table list
- `ColumnInfo`: Table column metadata from `PRAGMA table_info`
- `DesignerTab`: Multi-tab table designer state

AI-specific types are in `src/types/ai.ts`:
- `AIConfig`: Provider settings, execution policies, analysis options
- `StreamEvent`: Union type for all possible stream response events
- `ChatSession`: Conversation history and metadata

### Build Configuration

**Vite** (`vite.config.ts`):
- Uses `vite-plugin-electron` for main/preload bundling
- Externalizes native modules: `ssh2`, `cpu-features`, `nan`
- Monaco Editor is dependency-optimized for faster dev startup

**electron-builder** (`package.json` build section):
- `asar: false` - Native modules require filesystem access
- Explicit file inclusion for native modules and their dependencies
- Platform-specific targets defined (NSIS for Windows, AppImage/deb/rpm for Linux)

### Security Model

- `contextIsolation: true` - Preload runs in isolated context
- `nodeIntegration: false` - Renderer cannot access Node.js APIs directly
- All system access goes through IPC handlers in main process
- Sensitive data (SSH passwords/keys) should be encrypted (implementation pending)

## Working with the AI Module

When modifying AI-related code:

1. **LangChain is ESM-only** - Dynamic import required in main process:
   ```typescript
   const { ChatOpenAI } = await import('@langchain/openai')
   ```

2. **Streaming flow**: `chatStream()` returns an AsyncGenerator that yields `StreamEvent` objects. The IPC layer handles converting this to renderer events.

3. **Safety classification**: SQL statements are classified as SAFE (SELECT), WARNING (INSERT/UPDATE/DELETE with WHERE), or DANGEROUS (DROP, ALTER, DELETE without WHERE). Classification logic is in `electron/ai/utils/sql-safety.ts`.

4. **Adding new tools**: Define the tool in `sql-tools.ts`, register it in the agent's tool list, and add appropriate TypeScript types.

## Native Module Handling

The `ssh2` library depends on native C++ modules (`cpu-features`). Key points:

- Native modules must be rebuilt for the target Electron version: `npm run postinstall`
- Modules are externalized in Vite config to prevent bundling issues
- electron-builder explicitly includes native module files in the packaged app
- If `cpu-features` fails to build, `ssh2` will still work with slightly reduced performance

## File Locations for Common Tasks

- **Add new IPC handler**: Register in `electron/main.ts`, expose in `electron/preload.ts`, add type in preload's `declare global` block
- **Add new page**: Create component in `src/pages/`, add to `src/App.tsx` tab rendering logic
- **Modify database operations**: Edit `electron/services/sqliteService.ts`
- **Add AI capability**: Extend `electron/ai/agents/sql-agent.ts` or add tool in `electron/ai/tools/sql-tools.ts`
- **Change persisted state**: Update Zustand store in `src/stores/useAppStore.ts` and configure `partialize` for persistence
