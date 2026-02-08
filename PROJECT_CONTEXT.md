# SmartLex Project Context

## 1. Project Overview
**SmartLex** is a local-first, AI-powered semantic analysis and vocabulary management desktop application. It transforms unstructured AI interactions into structured linguistic assets, enabling deep learning and personal knowledge management.

*   **Version**: 0.1.8 (Beta)
*   **Platform**: Windows (Tauri v2 Desktop App)
*   **Core Value**: Deep semantic analysis, structured knowledge management, local data sovereignty.

## 2. Tech Stack & Architecture

### Frontend (UI/UX)
*   **Framework**: React 19 (Hooks, Context API)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS v4 (configured with PostCSS, supports Dark Mode via `@theme`)
*   **Build Tool**: Vite 6

### Backend (System Integration)
*   **Framework**: Tauri v2 (Rust)
*   **Capabilities**:
    *   `@tauri-apps/plugin-fs`: Local file system access (AppData persistence).
    *   `@tauri-apps/plugin-notification`: System-level notifications for background tasks.
    *   `fs` Scope: configured in `capabilities/default.json` for secure access.

### AI Engine (Intelligence Layer)
*   **Provider**: Volcengine (Doubao-Seed-1.6-thinking model) compatible with OpenAI/Gemini protocols.
*   **Service Layer**: `geminiService.ts`
    *   **Robust Parsing**: Implements `extractAndParseJSON` to handle non-standard LLM outputs (markdown stripping, boundary detection).
    *   **Dual Mode**: Separates `analyzeTerm` (Structured JSON) and `chatWithAI` (Free-form conversation).

### Data Persistence (Storage Strategy)
*   **Strategy**: Hybrid Storage (Local-First)
    *   **Tauri AppData**: Default location (`workspace.lex`) for seamless out-of-the-box experience.
    *   **Browser File System Access API**: Allows users to link and sync with a specific local file (e.g., in Dropbox/OneDrive).
    *   **LocalStorage**: Fallback cache.
*   **Format**: `.lex` (JSON-based schema containing `library` and `history`).

## 3. Core Features

### 3.1 Analysis Station (The Engine)
*   **Input**: Term, Context, Image (Base64).
*   **Output**: Structured `SemanticAnalysis` object:
    *   **Semantic Core**: Definition, Chinese Equivalent.
    *   **Pragmatics**: Tone (formal/informal), Register (academic/slang), Cultural Nuance.
    *   **Linguistic Network**: Synonyms, Collocations.
    *   **Origin**: Etymology/History.
*   **UX**: Fast response (direct API call), focus states, visual feedback.

### 3.2 Knowledge Library (The Asset)
*   **Visualization**: Masonry grid layout for browsing assets.
*   **Management**: Tagging system, Filtering (Metaphor/Idiom/Slang), Search.
*   **Export**:
    *   **PDF**: High-fidelity export using `html2canvas` + `jspdf` (off-screen rendering to avoid truncation).
    *   **Backup**: Full workspace export to `.lex` JSON file.

### 3.3 System Integration
*   **Notifications**: Global non-blocking `Toast` system (Success/Error/Info).
*   **Background Alerts**: Windows system notifications when analysis completes in background.
*   **Settings**: Data management (Clear Data, Backup), Version info.

## 4. Key Engineering Challenges & Solutions

### A. AI Output Instability
*   **Problem**: LLM often wraps JSON in markdown blocks or adds conversational filler, breaking `JSON.parse`.
*   **Solution**: Implemented a **Defensive Parsing Algorithm** in `geminiService.ts` that scans string boundaries to extract the outermost valid JSON object/array.

### B. PDF Generation in Frontend
*   **Problem**: `window.print()` is limited; direct screenshotting truncates scrolling content.
*   **Solution**: "Clone & Expand" technique. The DOM is cloned off-screen, forced to full height, rendered to canvas, then converted to PDF. Solved Tailwind v4 color space issues by enforcing Hex fallbacks.

### C. Performance
*   **Problem**: Initial intent recognition step added 2-3s latency.
*   **Solution**: Removed pre-classification. Default action is now direct analysis, significantly improving Time-to-Interactive (TTI).

## 5. File Structure
*   `src/components/`: UI modules (AnalysisStation, Library, AnalysisResult, Toast, etc.)
*   `src/services/`: Logic layer (storageService, geminiService)
*   `src/contexts/`: Global state (ToastContext)
*   `src-tauri/`: Rust backend configuration and capabilities
*   `DEV_LOG.md`: Comprehensive development history and changelog.

## 6. Future Roadmap
*   **Cloud Sync**: WebDAV/S3 integration.
*   **Mobile**: Adapt UI for iOS/Android via Tauri Mobile.
*   **Plugin System**: User-defined prompts for specific domains (Medical, Legal).
