# AI Organizer

A modern document management and organization system with intelligent segmentation, folder management, and smart notes.

## Features

- **Document Upload & Processing**: Upload documents and automatically parse them
- **Intelligent Segmentation**: Automatic document segmentation with multiple modes (QA, paragraphs, etc.)
- **Folder Management**: Organize segments into folders with drag-and-drop support
- **Smart Notes**: Create and manage notes linked to document chunks
- **Search**: Global search across documents, segments, and notes
- **Export**: Export documents and segments in multiple formats (JSON, CSV, TXT, Markdown)

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **TipTap** for rich text editing
- Code splitting with React.lazy and Suspense

### Backend
- **FastAPI** (Python)
- **SQLModel** for database models
- **SQLite** for data persistence
- JWT authentication

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- PowerShell (for Windows bootstrap script)

### Installation

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Bootstrap the development environment:**
   ```powershell
   cd backend
   .\scripts\dev_bootstrap.ps1
   ```

### Development

1. **Start the backend server:**
   ```bash
   cd backend
   python -m uvicorn ai_organizer.main:app --reload
   ```
   Backend runs on `http://127.0.0.1:8000`

2. **Start the frontend dev server:**
   ```bash
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

### Build

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Project Structure

```
├── src/                    # Frontend source code
│   ├── pages/              # Page components
│   ├── components/         # Reusable components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility libraries
│   └── auth/               # Authentication logic
├── backend/                # Backend source code
│   ├── src/ai_organizer/   # Main application code
│   └── scripts/            # Utility scripts
└── public/                 # Static assets
```

## Key Features Implementation

### Folder Management
- Create, rename, and delete folders
- Drag-and-drop segments into folders
- Real-time UI updates without page refresh
- Cache invalidation for consistent data

### Smart Notes
- Rich text editing with TipTap
- Tag and category management
- Linked to document chunks
- Search and filter capabilities

### Document Segmentation
- Multiple segmentation modes
- Manual segment creation
- Segment editing and deletion
- Export capabilities

## Development Notes

- **Code Splitting**: Main routes are lazy-loaded for better performance
- **State Management**: Custom hooks for workspace operations
- **Error Handling**: ErrorBoundary component for React error catching
- **Type Safety**: Full TypeScript with strict mode enabled

## Testing

```bash
npm test
```

## Performance

The application is optimized for performance with:
- **Code Splitting**: Routes are lazy-loaded using React.lazy
- **Memoization**: Critical components use React.memo, useMemo, and useCallback
- **API Caching**: GET requests are cached to reduce server load
- **Request Deduplication**: Identical concurrent requests are deduplicated

### Performance Tips

- Use the browser's DevTools Performance tab to profile the application
- Monitor network requests in the Network tab
- Check bundle size with `npm run build` and review the output

## CI/CD

The project includes GitHub Actions workflows for:
- **CI**: Automated testing and type checking on push/PR
- **Build**: Verification that the project builds successfully

Workflows are located in `.github/workflows/ci.yml`.

## License

Private project
