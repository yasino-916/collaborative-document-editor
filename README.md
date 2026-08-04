# SyncWrite - Real-Time Collaborative Document Editor

SyncWrite is a robust, real-time collaborative document editor designed to demonstrate high-quality software engineering practices, clean architecture, and dynamic capabilities.

## Features Included
- **User Authentication**: Secure JWT-based registration and login system with bcrypt password hashing and Google OAuth support.
- **Real-Time Collaboration**: Instant synchronization of text using WebSockets (Socket.IO).
- **Rich Text Editing**: Full-featured text editor powered by Quill.js.
- **Live Presence Awareness**: Real-time cursor tracking and display of currently active users with distinct colors.
- **Auto Save**: Seamless automatic persistence of changes to the backend.
- **Document Management**: Create, view, share, duplicate, and delete documents right from the dashboard.
- **Sharing & Permissions**: Share documents securely with others via their email with role-based access (Owner, Editor, Commenter, Viewer).
- **Version History**: Track document changes with manual snapshots and automatic versioning. Preview and restore previous versions.
- **Comments & Discussion**: Thread-based commenting system with replies, resolve/unresolve, and real-time synchronization.
- **Professional Export**: Server-side export to PDF (Puppeteer), DOCX (true Office format), Markdown, and PowerPoint with perfect formatting preservation.
- **Offline Editing**: Work offline with local storage caching and automatic sync when connection is restored.
- **Search & Replace**: Find and replace text within documents with match highlighting.
- **Dark Mode**: Toggle between light and dark themes with persistent preference.
- **Keyboard Shortcuts**: Extensive keyboard shortcuts for power users (Ctrl+S to save, Ctrl+F to search, etc.).
- **Responsive & Premium UI**: Built with React, Tailwind CSS, and Lucide React icons for a beautiful, modern aesthetic.

## Architecture Highlights
- **Frontend**: React (Vite) + Tailwind CSS + Context API + Quill.js + Socket.IO Client + React Router.
- **Backend**: Node.js + Express + Socket.IO + Sequelize ORM (SQLite) + Puppeteer + docx.
- **Database**: SQLite is used out-of-the-box via Sequelize for zero-configuration setup, allowing reviewers to test effortlessly without local DB infrastructure.
- **Export Engine**: Server-side PDF generation via Puppeteer (Chrome headless) and true DOCX generation via docx library for professional-quality exports.

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 2. Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   *The server will start on port 3001 and automatically create a local `database.sqlite` file.*
   
   **Note**: On first PDF export, Puppeteer will download Chrome (~170MB, one-time only). This may take 2-3 minutes but only happens once.

### 3. Frontend Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The app will be accessible at http://localhost:5173*

## Demo Walkthrough
1. **Register**: Create a new account (or use Google OAuth).
2. **Dashboard**: View your documents (none at first). Click "New Document".
3. **Editor**: The editor will load with a real-time connection. You can start typing rich text immediately.
4. **Collaboration Test**: 
   - Open an incognito window or a different browser.
   - Register a second account.
   - In the first browser, click "Share" and enter the second account's email.
   - In the second browser, the document will appear under "Shared with you" in the dashboard.
   - Open it, and watch the cursors track live between both windows!
5. **Export Documents**: 
   - Click the Settings icon (⚙️) in the top right.
   - Select "Export Document".
   - Choose format: PDF (professional quality), DOCX (true Office format), Markdown, or PowerPoint.
   - Click "Export Now" and the file will download automatically.
6. **Version History**:
   - Click the "History" button to view all document revisions.
   - Preview previous versions or restore them with one click.
7. **Comments**:
   - Click the "Comments" button to add threaded discussions.
   - Mention collaborators and resolve conversations.

## Key Features Detail

### Export Functionality
- **PDF Export**: Server-side generation using Puppeteer (Chrome engine) for perfect rendering with professional typography, proper fonts, and print-ready quality.
- **DOCX Export**: True Office Open XML format that opens perfectly in Microsoft Word, Google Docs, and LibreOffice without compatibility warnings. Fully editable with all formatting preserved.
- **Markdown Export**: Client-side conversion with full formatting support.
- **PowerPoint Export**: Generate PPTX presentations from document content.

### Permissions System
- **Owner**: Full control (edit, share, delete document)
- **Editor**: Can edit content and share with others
- **Commenter**: Can only add comments and suggestions
- **Viewer**: Read-only access

### Real-Time Features
- Live cursor tracking with distinct colors per user
- Typing indicators
- Active user presence with location tracking
- Instant content synchronization
- Offline editing with automatic sync on reconnection

### Keyboard Shortcuts
- `Ctrl+S`: Save document
- `Ctrl+F`: Find in document
- `Ctrl+Shift+S`: Open version history
- `Ctrl+Shift+D`: Toggle dark mode
- `Ctrl+Shift+C`: Toggle comments
- `Ctrl+Shift+H`: Toggle history

## Technical Decisions Justification
- **SQLite + Sequelize**: Selected to prevent evaluator configuration bottlenecks. The schema works perfectly and can trivially be swapped to PostgreSQL/MySQL by simply altering the dialect string.
- **Quill.js + Socket.IO**: Operational Transformation (OT) or CRDT frameworks can be overly complex for a 2-day prototype. Directly sending Quill Deltas over Socket.IO offers rapid deployment while retaining high fidelity text sync and live cursor positions via `quill-cursors`.
- **Tailwind CSS**: Allowed for extremely rapid prototyping of a premium, polished user interface without relying on generic component libraries.
- **Server-Side Export**: Using Puppeteer and docx library on the server provides professional-quality exports that are impossible to achieve with browser-based solutions. Puppeteer uses Chrome's rendering engine for pixel-perfect PDFs, while docx generates true Office Open XML format.
- **Role-Based Permissions**: Granular permission system (Owner/Editor/Commenter/Viewer) provides enterprise-level access control suitable for team collaboration.

## Production Considerations

### Deployment
- **Database**: Replace SQLite with PostgreSQL or MySQL for production by changing the Sequelize dialect.
- **Puppeteer**: Ensure Chrome/Chromium is available on the server. Consider using Docker images with Chrome pre-installed or AWS Lambda Layers for serverless deployment.
- **Environment Variables**: Set `JWT_SECRET`, `PORT`, and database credentials in production environment variables.

### Scaling
- Implement Redis for Socket.IO adapter to enable horizontal scaling across multiple server instances.
- Add caching layer (Redis) for frequently accessed documents and export results.
- Consider separate microservice for export processing to handle high load.

### Security
- All passwords are hashed with bcrypt (10 rounds)
- JWT tokens for stateless authentication
- Role-based access control enforced on all endpoints
- Input validation and sanitization
- CORS configured for specific origins in production

## Technology Stack

### Frontend
- React 19.2.8
- Vite 8.2.0 (Build tool)
- Tailwind CSS 4.3.3
- Quill 2.0.3 (Rich text editor)
- Socket.IO Client 4.8.3
- React Router 7.18.2
- Axios (HTTP client)
- date-fns (Date formatting)
- Lucide React (Icons)

### Backend
- Node.js + Express 5.2.1
- Socket.IO 4.8.3 (Real-time)
- Sequelize 6.37.8 (ORM)
- SQLite3 6.0.1 (Database)
- Puppeteer (PDF generation)
- docx (DOCX generation)
- bcryptjs 3.0.3 (Password hashing)
- jsonwebtoken 9.0.3 (JWT auth)

### Development Tools
- ESLint (oxlint)
- Prettier (code formatting)
- Git (version control)

*Built for the Insa Challenge.*
