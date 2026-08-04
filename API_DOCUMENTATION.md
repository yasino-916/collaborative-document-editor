# API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
Include JWT token in the Authorization header for protected endpoints:
```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### Register
`POST /api/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com" }
}
```

---

### Login
`POST /api/auth/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com" }
}
```

---

### Google OAuth
`POST /api/auth/google`

**Request:**
```json
{
  "token": "google_access_token"
}
```

**Response:** Same as Login

---

### Get Current User
`GET /api/auth/me` 🔒

**Response:**
```json
{
  "user": { "id": "uuid", "name": "John Doe", "email": "john@example.com" }
}
```

---

## Document Endpoints

### Get All Documents
`GET /api/documents` 🔒

**Response:**
```json
{
  "ownedDocs": [{ "id": "uuid", "title": "My Document", "content": "...", "Owner": {...} }],
  "sharedDocs": [{ "id": "uuid", "title": "Shared Doc", "content": "...", "Owner": {...} }]
}
```

---

### Create Document
`POST /api/documents` 🔒

**Request:**
```json
{
  "title": "My New Document"
}
```

**Response:**
```json
{
  "id": "uuid",
  "title": "My New Document",
  "content": "",
  "ownerId": "uuid"
}
```

---

### Get Document
`GET /api/documents/:id` 🔒

**Response:**
```json
{
  "document": { "id": "uuid", "title": "...", "content": "...", "Owner": {...}, "Collaborators": [...] },
  "role": "OWNER"
}
```

---

### Update Document Title
`PUT /api/documents/:id` 🔒 (Owner/Editor only)

**Request:**
```json
{
  "title": "Updated Title"
}
```

---

### Duplicate Document
`POST /api/documents/:id/duplicate` 🔒

Creates a copy of the document owned by you.

---

### Delete Document
`DELETE /api/documents/:id` 🔒 (Owner only)

**Response:**
```json
{
  "message": "Deleted"
}
```

---

## Sharing Endpoints

### Share Document
`POST /api/documents/:id/share` 🔒 (Owner/Editor only)

**Request:**
```json
{
  "email": "collaborator@example.com",
  "role": "EDITOR"
}
```

**Roles:** `VIEWER`, `COMMENTER`, `EDITOR`

**Response:**
```json
{
  "message": "Shared successfully with Jane Smith as EDITOR",
  "collab": { "id": "uuid", "role": "EDITOR", ... }
}
```

---

### Get Collaborators
`GET /api/documents/:id/collaborators` 🔒

**Response:**
```json
{
  "owner": { "id": "uuid", "name": "John Doe", "email": "john@example.com" },
  "collaborators": [
    { "id": "uuid", "role": "EDITOR", "User": { "name": "Jane", "email": "jane@example.com" } }
  ]
}
```

---

### Remove Collaborator
`DELETE /api/documents/:id/collaborators/:userId` 🔒 (Owner only)

---

## Comment Endpoints

### Get Comments
`GET /api/documents/:id/comments` 🔒

**Response:**
```json
[
  {
    "id": "uuid",
    "content": "This is a comment",
    "resolved": false,
    "Author": { "name": "John Doe" },
    "Replies": [
      { "id": "uuid", "content": "Reply", "Author": {...} }
    ]
  }
]
```

---

### Add Comment/Reply
`POST /api/documents/:id/comments` 🔒 (Not Viewer)

**Request:**
```json
{
  "content": "This is my comment",
  "parentId": null
}
```

Set `parentId` to comment ID for replies.

---

### Toggle Resolve
`PUT /api/documents/:id/comments/:commentId/resolve` 🔒 (Not Viewer)

Toggles resolved status.

---

### Edit Comment
`PUT /api/documents/:id/comments/:commentId` 🔒 (Own comments only)

**Request:**
```json
{
  "content": "Updated comment"
}
```

---

### Delete Comment
`DELETE /api/documents/:id/comments/:commentId` 🔒 (Author or Owner)

---

## Version History Endpoints

### Get Versions
`GET /api/documents/:id/versions` 🔒

**Response:**
```json
[
  {
    "id": "uuid",
    "versionName": "Draft 1",
    "content": "...",
    "createdAt": "2026-08-04T10:00:00.000Z",
    "Creator": { "name": "John Doe" }
  }
]
```

---

### Create Snapshot
`POST /api/documents/:id/versions` 🔒 (Owner/Editor only)

**Request:**
```json
{
  "versionName": "Draft 1",
  "content": "<p>Optional content override</p>"
}
```

---

### Restore Version
`POST /api/documents/:id/versions/:versionId/restore` 🔒 (Owner/Editor only)

Restores document to selected version. Creates backup before restoring.

---

## Export Endpoints

### Export PDF
`POST /api/documents/:id/export/pdf` 🔒

**Request:**
```json
{
  "content": "<p>Optional content override</p>"
}
```

**Response:** Binary PDF file download

**Note:** First export downloads Chrome (~170MB, one-time).

---

### Export DOCX
`POST /api/documents/:id/export/docx` 🔒

**Request:**
```json
{
  "content": "<p>Optional content override</p>"
}
```

**Response:** Binary DOCX file download (true Office format)

---

## WebSocket Events

### Connection
**URL:** `ws://localhost:3001`

**Connect to document:**
```javascript
socket.emit('get-document', { 
  documentId: 'uuid', 
  token: 'jwt_token' 
});
```

**Server responses:**
- `load-document` - Initial content and role
- `active-users` - List of online users
- `unauthorized` - Access denied

---

### Real-Time Events

#### Send/Receive Changes
```javascript
// Send (Owner/Editor only)
socket.emit('send-changes', deltaObject);

// Receive
socket.on('receive-changes', (delta) => { /* apply delta */ });
```

---

#### Cursor Tracking
```javascript
// Send your cursor position
socket.emit('cursor-move', { 
  range: { index: 10, length: 0 },
  activeLocation: 'Line 5'
});

// Receive others' cursors
socket.on('receive-cursor', (data) => {
  // data: { id, name, color, range, activeLocation }
});
```

---

#### Typing Indicators
```javascript
socket.emit('typing');           // Start typing
socket.emit('stop-typing');      // Stop typing

socket.on('user-typing', ({ id, name }) => {});
socket.on('user-stopped-typing', ({ id }) => {});
```

---

#### Save Document
```javascript
// Auto-saves every 1s, manual save:
socket.emit('save-document', htmlContent);
```

---

#### Active Users
```javascript
socket.on('active-users', (users) => {
  // Array of: { id, name, color, role, status, cursor, ... }
});
```

---

#### Real-Time Notifications
```javascript
socket.on('version-created', (version) => {});
socket.on('document-restored', ({ content, restoredBy }) => {});
socket.on('comment-added', (comment) => {});
socket.on('comment-resolved', ({ commentId, resolved }) => {});
socket.on('comment-edited', ({ commentId, content }) => {});
socket.on('comment-deleted', ({ commentId }) => {});
```

---

## Permission Levels

| Role         | View  | Edit | Comment | Share | Delete |
|--------------|-------|------|---------|-------|--------|
| **OWNER**    | ✅   | ✅   | ✅      | ✅   | ✅     |
| **EDITOR**   | ✅   | ✅   | ✅      | ✅   | ❌     |
| **COMMENTER**| ✅   | ❌   | ✅      | ❌   | ❌     |
| **VIEWER**   | ✅   | ❌   | ❌      | ❌   | ❌     |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

**Error format:**
```json
{
  "error": "Error message description"
}
```

---

## Quick Examples

### Complete Authentication Flow
```javascript
// Register
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, password })
});
const { token, user } = await response.json();

// Use token for authenticated requests
const docs = await fetch('/api/documents', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

### Complete Real-Time Editing Flow
```javascript
// 1. Connect to WebSocket
const socket = io('http://localhost:3001');

// 2. Join document
socket.emit('get-document', { documentId, token });

// 3. Load initial content
socket.on('load-document', ({ content, role }) => {
  editor.setContent(content);
});

// 4. Send changes on edit
editor.on('text-change', (delta) => {
  socket.emit('send-changes', delta);
  socket.emit('save-document', editor.getHTML());
});

// 5. Receive changes from others
socket.on('receive-changes', (delta) => {
  editor.updateContents(delta);
});
```

---

## API Summary

**Total Endpoints:** 23 REST + 15 WebSocket events

**Authentication:** 4 endpoints
**Documents:** 6 endpoints  
**Sharing:** 3 endpoints
**Comments:** 5 endpoints
**Versions:** 3 endpoints
**Export:** 2 endpoints

---

*For detailed database schema, see `DATABASE_SCHEMA.md`*
*For setup instructions, see `README.md`*
