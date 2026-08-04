# Database Schema

## Overview
SyncWrite uses SQLite as the database with Sequelize ORM. The schema consists of 5 main tables supporting user authentication, document management, collaboration, versioning, and commenting.

---

## Tables

### 1. Users
Stores user account information.

```sql
CREATE TABLE Users (
  id UUID PRIMARY KEY DEFAULT UUIDV4,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```

**Fields:**
- `id`: Unique user identifier (UUID)
- `name`: User's full name
- `email`: User's email address (unique, used for login)
- `password`: Bcrypt hashed password
- `createdAt`: Account creation timestamp
- `updatedAt`: Last account update timestamp

**Indexes:**
- Primary Key: `id`
- Unique Index: `email`

---

### 2. Documents
Stores document metadata and content.

```sql
CREATE TABLE Documents (
  id UUID PRIMARY KEY DEFAULT UUIDV4,
  title VARCHAR(255) DEFAULT 'Untitled Document',
  content TEXT DEFAULT '',
  ownerId UUID NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (ownerId) REFERENCES Users(id)
);
```

**Fields:**
- `id`: Unique document identifier (UUID)
- `title`: Document title
- `content`: Document HTML content (Quill Delta HTML)
- `ownerId`: Reference to the document owner (User.id)
- `createdAt`: Document creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships:**
- `ownerId` → `Users.id` (Many-to-One)

**Indexes:**
- Primary Key: `id`
- Foreign Key: `ownerId`

---

### 3. Collaborators
Manages document sharing and permissions.

```sql
CREATE TABLE Collaborators (
  id UUID PRIMARY KEY DEFAULT UUIDV4,
  documentId UUID NOT NULL,
  userId UUID NOT NULL,
  role ENUM('VIEWER', 'COMMENTER', 'EDITOR') DEFAULT 'VIEWER',
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (documentId) REFERENCES Documents(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES Users(id)
);
```

**Fields:**
- `id`: Unique collaborator relationship identifier
- `documentId`: Reference to the shared document
- `userId`: Reference to the collaborator user
- `role`: Permission level (VIEWER, COMMENTER, EDITOR)
- `createdAt`: Share timestamp
- `updatedAt`: Last permission update timestamp

**Role Types:**
- `VIEWER`: Read-only access
- `COMMENTER`: Can add comments but not edit content
- `EDITOR`: Can edit content and share with others

**Relationships:**
- `documentId` → `Documents.id` (Many-to-One, CASCADE on delete)
- `userId` → `Users.id` (Many-to-One)

**Indexes:**
- Primary Key: `id`
- Foreign Keys: `documentId`, `userId`
- Composite Index: `(documentId, userId)` for faster lookups

---

### 4. DocumentVersions
Stores document revision history.

```sql
CREATE TABLE DocumentVersions (
  id UUID PRIMARY KEY DEFAULT UUIDV4,
  documentId UUID NOT NULL,
  content TEXT NOT NULL,
  versionName VARCHAR(255) DEFAULT 'Snapshot',
  createdBy UUID NOT NULL,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (documentId) REFERENCES Documents(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES Users(id)
);
```

**Fields:**
- `id`: Unique version identifier
- `documentId`: Reference to the parent document
- `content`: Snapshot of document content at this version
- `versionName`: Human-readable version name (e.g., "Draft 1", "Auto-saved Revision")
- `createdBy`: User who created this version
- `createdAt`: Version creation timestamp
- `updatedAt`: Version update timestamp

**Relationships:**
- `documentId` → `Documents.id` (Many-to-One, CASCADE on delete)
- `createdBy` → `Users.id` (Many-to-One)

**Indexes:**
- Primary Key: `id`
- Foreign Keys: `documentId`, `createdBy`

**Version Types:**
- Manual Snapshot: Created by user
- Auto-saved Revision: Created automatically every 2 minutes
- Pre-restore Snapshot: Created before version restoration
- Restored Version: Created after successful restoration

---

### 5. Comments
Stores document comments and threaded discussions.

```sql
CREATE TABLE Comments (
  id UUID PRIMARY KEY DEFAULT UUIDV4,
  documentId UUID NOT NULL,
  userId UUID NOT NULL,
  content TEXT NOT NULL,
  parentId UUID NULL,
  resolved BOOLEAN DEFAULT FALSE,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  FOREIGN KEY (documentId) REFERENCES Documents(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES Users(id),
  FOREIGN KEY (parentId) REFERENCES Comments(id) ON DELETE CASCADE
);
```

**Fields:**
- `id`: Unique comment identifier
- `documentId`: Reference to the document
- `userId`: Comment author
- `content`: Comment text content
- `parentId`: Reference to parent comment (NULL for top-level comments)
- `resolved`: Whether the comment thread is resolved
- `createdAt`: Comment creation timestamp
- `updatedAt`: Last edit timestamp

**Relationships:**
- `documentId` → `Documents.id` (Many-to-One, CASCADE on delete)
- `userId` → `Users.id` (Many-to-One)
- `parentId` → `Comments.id` (Self-referencing, CASCADE on delete for threaded replies)

**Indexes:**
- Primary Key: `id`
- Foreign Keys: `documentId`, `userId`, `parentId`
- Index on `(documentId, parentId)` for faster comment tree retrieval

---

## Entity Relationship Diagram

```
┌─────────────┐
│    Users    │
│─────────────│
│ id (PK)     │
│ name        │
│ email (UQ)  │
│ password    │
└──────┬──────┘
       │
       │ owns (1:N)
       ↓
┌─────────────────┐
│   Documents     │
│─────────────────│
│ id (PK)         │
│ title           │
│ content         │
│ ownerId (FK)    │←───────────┐
└────┬─────┬──────┘            │
     │     │                   │
     │     │ has (1:N)         │
     │     ↓                   │
     │  ┌──────────────────┐  │
     │  │DocumentVersions  │  │
     │  │──────────────────│  │
     │  │ id (PK)          │  │
     │  │ documentId (FK)  │──┘
     │  │ content          │
     │  │ versionName      │
     │  │ createdBy (FK)   │───┐
     │  └──────────────────┘   │
     │                          │
     │ has (1:N)                │
     ↓                          │
┌──────────────────┐            │
│   Comments       │            │
│──────────────────│            │
│ id (PK)          │            │
│ documentId (FK)  │────────────┘
│ userId (FK)      │────────────┐
│ content          │            │
│ parentId (FK)    │──┐         │
│ resolved         │  │         │
└──────────────────┘  │         │
         ↑            │         │
         └────────────┘         │
         (self-reference)       │
                                │
┌──────────────────┐            │
│  Collaborators   │            │
│──────────────────│            │
│ id (PK)          │            │
│ documentId (FK)  │────────────┘
│ userId (FK)      │────────────┐
│ role (ENUM)      │            │
└──────────────────┘            │
                                │
                    ┌───────────┘
                    │
                    ↓
            ┌─────────────┐
            │    Users    │
            └─────────────┘
```

---

## Relationships Summary

### User Relationships
- **User → Documents**: One-to-Many (A user can own multiple documents)
- **User → Collaborators**: One-to-Many (A user can collaborate on multiple documents)
- **User → DocumentVersions**: One-to-Many (A user can create multiple versions)
- **User → Comments**: One-to-Many (A user can create multiple comments)

### Document Relationships
- **Document → User (Owner)**: Many-to-One (Each document has one owner)
- **Document → Collaborators**: One-to-Many (A document can have multiple collaborators)
- **Document → DocumentVersions**: One-to-Many (A document can have multiple versions)
- **Document → Comments**: One-to-Many (A document can have multiple comments)

### Self-Referencing Relationships
- **Comment → Comment (Parent)**: Self-referencing for threaded replies

---

## Data Flow

### Document Creation
```
User creates document
    ↓
INSERT INTO Documents (ownerId = user.id)
    ↓
INSERT INTO DocumentVersions (versionName = "Initial Version")
```

### Document Sharing
```
Owner shares document with collaborator
    ↓
INSERT INTO Collaborators (documentId, userId, role)
    ↓
Collaborator gains access based on role
```

### Real-Time Editing
```
User edits document
    ↓
Socket.IO broadcasts changes
    ↓
Auto-save triggers (every 1 second)
    ↓
UPDATE Documents SET content = newContent
    ↓
Auto-version save (every 2 minutes)
    ↓
INSERT INTO DocumentVersions
```

### Comments Thread
```
User adds comment
    ↓
INSERT INTO Comments (parentId = NULL)
    ↓
Another user replies
    ↓
INSERT INTO Comments (parentId = parent_comment.id)
```

---

## Indexes and Performance

### Primary Indexes
- All tables have UUID primary keys for global uniqueness
- UUIDs prevent ID collision in distributed systems

### Foreign Key Indexes
- Automatic indexes on all foreign keys for JOIN performance
- Cascading deletes ensure referential integrity

### Composite Indexes
- `(documentId, userId)` on Collaborators for permission checks
- `(documentId, parentId)` on Comments for thread retrieval

### Query Optimization
- Use `include` in Sequelize for eager loading
- Limit version history queries with pagination
- Index on `email` for fast user lookup during login

---

## Migration from SQLite to PostgreSQL

To switch from SQLite to PostgreSQL in production:

1. Update `server/db.js`:
```javascript
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: false
});
```

2. Install PostgreSQL driver:
```bash
npm install pg pg-hstore
```

3. Run migrations:
```bash
npx sequelize-cli db:migrate
```

---

## Database File Location

**Development:**
- File: `server/database.sqlite`
- Size: ~500KB-5MB (depending on usage)
- Created automatically on first server start

**Production:**
- Use PostgreSQL or MySQL
- Implement proper backup strategy
- Enable connection pooling

---

## Security Considerations

1. **Password Storage**: All passwords are hashed with bcrypt (10 rounds)
2. **SQL Injection**: Sequelize ORM prevents SQL injection with parameterized queries
3. **Cascade Deletes**: Properly configured to maintain referential integrity
4. **Access Control**: Role-based permissions enforced at application level
5. **Data Encryption**: Consider encrypting sensitive document content in production

---

## Backup Strategy (Production)

1. **Automated Backups**: Daily full backups + incremental backups every 6 hours
2. **Point-in-Time Recovery**: Enable transaction logs for PostgreSQL
3. **Disaster Recovery**: Store backups in different geographic regions
4. **Retention Policy**: Keep backups for 30 days minimum

---

*Database schema version: 1.0*
*Last updated: August 2026*
