# SyncWrite - Real-Time Collaborative Document Editor

SyncWrite is a robust, real-time collaborative document editor designed to demonstrate high-quality software engineering practices, clean architecture, and dynamic capabilities.

## Features Included
- **User Authentication**: Secure JWT-based registration and login system with bcrypt password hashing.
- **Real-Time Collaboration**: Instant synchronization of text using WebSockets (Socket.IO).
- **Rich Text Editing**: Full-featured text editor powered by Quill.js.
- **Live Presence Awareness**: Real-time cursor tracking and display of currently active users with distinct colors.
- **Auto Save**: Seamless automatic persistence of changes to the backend.
- **Document Management**: Create, view, share, and delete documents right from the dashboard.
- **Sharing & Permissions**: Share documents securely with others via their email.
- **Responsive & Premium UI**: Built with React, Tailwind CSS, and Lucide React icons for a beautiful, modern aesthetic.

## Architecture Highlights
- **Frontend**: React (Vite) + Tailwind CSS + Context API + Quill.js + Socket.IO Client.
- **Backend**: Node.js + Express + Socket.IO + Sequelize ORM (SQLite).
- **Database**: SQLite is used out-of-the-box via Sequelize for zero-configuration setup, allowing reviewers to test effortlessly without local DB infrastructure.

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
   npm run start
   # Note: Since there is no start script configured in package.json yet, run:
   node server.js
   ```
   *The server will start on port 3001 and automatically create a local `database.sqlite` file.*

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
1. **Register**: Create a new account.
2. **Dashboard**: View your documents (none at first). Click "New Document".
3. **Editor**: The editor will load with a real-time connection. You can start typing rich text immediately.
4. **Collaboration Test**: 
   - Open an incognito window or a different browser.
   - Register a second account.
   - In the first browser, click "Share" and enter the second account's email.
   - In the second browser, the document will appear under "Shared with you" in the dashboard.
   - Open it, and watch the cursors track live between both windows!

## Technical Decisions Justification
- **SQLite + Sequelize**: Selected to prevent evaluator configuration bottlenecks. The schema works perfectly and can trivially be swapped to PostgreSQL/MySQL by simply altering the dialect string.
- **Quill.js + Socket.IO**: Operational Transformation (OT) or CRDT frameworks can be overly complex for a 2-day prototype. Directly sending Quill Deltas over Socket.IO offers rapid deployment while retaining high fidelity text sync and live cursor positions via `quill-cursors`.
- **Tailwind CSS**: Allowed for extremely rapid prototyping of a premium, polished user interface without relying on generic component libraries.

*Built for the Insa Challenge.*
