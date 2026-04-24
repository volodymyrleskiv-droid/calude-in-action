# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup       # One-time setup: install deps, generate Prisma client, run migrations
npm run dev         # Start dev server with Turbopack
npm run build       # Production build
npm run lint        # ESLint
npm run test        # Run all tests with Vitest
npm run db:reset    # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat, Claude generates code using tool calls, and a live preview renders the result in an iframe.

### Request Flow

1. User submits a message → `ChatContext` (`/src/lib/contexts/chat-context.tsx`) calls the AI SDK's `useChat` hook
2. Request hits `/src/app/api/chat/route.ts`, which calls `streamText()` with Claude
3. Claude responds via two tools: `str_replace_editor` (create/view/edit files) and `file_manager` (rename/delete)
4. Tool calls update the in-memory `VirtualFileSystem` via `FileSystemContext`
5. `PreviewFrame` detects file changes and re-renders the iframe

### Virtual File System (`/src/lib/file-system.ts`)

Core abstraction: an in-memory `Map<string, VirtualFile>` tree. All AI-generated code lives here — never on disk. The entry point the iframe expects is `/App.jsx`. The file system is serializable (`serialize()` / `deserializeFromNodes()`) for persistence.

### Live Preview (`/src/components/preview/`)

`PreviewFrame` renders generated JSX in a sandboxed iframe using Babel Standalone for runtime JSX → JS transpilation (`/src/lib/transform/jsx-transformer.ts`). It constructs an import map so components can import each other by path.

### AI Provider (`/src/lib/provider.ts`)

Selects between the real Anthropic model (`claude-haiku-4-5`) and a `MockLanguageModel` when `ANTHROPIC_API_KEY` is absent. The prompt is in `/src/lib/prompts/generation.tsx`. The model is configured for up to 40 tool-use steps (4 for the mock).

### Persistence

- **Authenticated users**: Projects stored in Prisma/SQLite (`prisma/schema.prisma`)
- **Anonymous users**: `sessionStorage` via the anon-work-tracker (`/src/lib/anon-work-tracker.ts`), with migration to a real project on sign-up
- Auth uses JWT cookies (7-day expiry) with bcrypt password hashing — no third-party auth provider

### Three-Panel UI (`/src/app/main-content.tsx`)

Resizable panels (react-resizable-panels): Chat | Editor (Monaco) | Preview. The top-level pages are `/src/app/page.tsx` (new session) and `/src/app/[projectId]/page.tsx` (saved project).

## Database

The database schema is defined in `prisma/schema.prisma`. Reference it anytime you need to understand the structure of data stored in the database.

## Key Conventions

- Use `@/` path alias throughout (maps to `src/`)
- Generated code must use Tailwind CSS for styling — no hardcoded styles or `<style>` tags
- Client components require `"use client"`; server actions require `"use server"`
- Tests live in `__tests__/` subdirectories alongside the code they test
- Vitest runs in JSDOM environment; browser APIs need mocking

### 