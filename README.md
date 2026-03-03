# ☁️ Cloud Drive

A full-stack collaborative document editor and file manager with real-time editing locks, comprehensive sharing capabilities, and multilingual support.

![Node.js](https://img.shields.io/badge/Node.js-18.x+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.0-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-6.x+-47A248?logo=mongodb&logoColor=white)

## ✨ Features

### 📝 Document Editing
- **Rich Text Editor** powered by Editor.js with support for:
  - Headings (H1-H6), paragraphs, lists, checklists
  - Tables, code blocks, quotes, delimiters
  - Inline formatting (bold, italic, underline, inline code)
- **Undo/Redo** functionality (Ctrl+Z / Ctrl+Y)
- **Auto-save** with unsaved changes warning
- **PDF Export** with formatted output
- **DOCX Import** with automatic conversion to Editor.js format

### 🔒 Collaborative Editing
- **Document Locking System**
  - First-In-First-Out (FIFO) queue for waiting editors
  - Automatic lock release after 5 minutes of inactivity
  - 30-second grace period for accidental exits
  - Force unlock for document owners
  - Real-time heartbeat mechanism (every 5 seconds)
- **Sharing Options**
  - Grant edit access to specific users
  - Generate public view-only links
  - Manage permissions with ease

### 💬 Comments
- **Inline Comments** with text selection
- Comment resolution workflow (Active/Resolved tabs)
- Context-aware comments linked to specific blocks

### 📁 File Management
- **Folder Organization** with move/create/delete operations
- **Search & Sort** by name, creation date, or modification date
- **Recycle Bin** with restore and permanent delete
- **File Actions**: Clone, rename, move to folder
- **Image Uploads** supported
- **Pagination** (3 files per page)

### 🎨 User Experience
- **Dark/Light Theme Toggle**
- **Multilingual Support** (i18n)
  - English, Finnish, Romanian, Russian, Polish
  - Auto-detection based on browser language
- **Responsive Design** with Material UI
- **Custom Profile Pictures** (up to 5MB)

### 🔐 Security
- **JWT Authentication** (6-hour token expiry)
- **Password Requirements**:
  - Minimum 8 characters
  - At least 1 uppercase, 1 lowercase, 1 digit
  - At least 1 special character (#, !, &, %, ?)
  - No more than 2 identical consecutive characters
- **bcrypt** password hashing
- **Input Validation** with express-validator

---

## 🚀 Installation

### Prerequisites

| Software | Minimum Version | Download |
|----------|----------------|----------|
| Node.js | 18.x or higher (LTS recommended) | [nodejs.org](https://nodejs.org) |
| npm | 9.x or higher | Included with Node.js |
| MongoDB | 6.x or higher | [MongoDB Community](https://www.mongodb.com/try/download/community) |

### Setup

1. **Clone the repository**
   ```bash
   git clone <https://github.com/MarulCristi/CloudDrive>
   cd cloud-drive
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   This automatically installs dependencies for both server and client.

   Alternatively, install manually:
   ```bash
   # Server dependencies
   cd server
   npm install

   # Client dependencies
   cd ../client
   npm install
   cd ..
   ```

3. **Start MongoDB**
   
   Ensure MongoDB is running locally on the default port (27017).
   The application connects to: `mongodb://127.0.0.1:27017/testdb`

4. **Start the application**
   
   Open two terminals from the project root:

   **Terminal 1 - Backend:**
   ```bash
   npm run dev:server
   ```

   **Terminal 2 - Frontend:**
   ```bash
   npm run dev:client
   ```

   The Vite dev server starts on port 5173 and proxies `/api` and `/uploads` requests to `http://localhost:3000`.

5. **Access the application**
   
   Open your browser and navigate to: **http://localhost:5173**

---

## 🧪 Testing

The project includes comprehensive test suites:
- **Backend**: 28 tests (input validation, JWT authentication middleware)
- **Frontend**: 17 tests (login/register, logout, theme, protected routes, etc.)

### Run Tests

**Client-side tests:**
```bash
cd client
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
```

**Server-side tests:**
```bash
cd server
npm test              # Run tests once
npm run test:watch    # Run tests in watch mode
```

---

## 📖 User Guide

### Registration

1. Navigate to http://localhost:5173/register
2. Fill in the registration form following these requirements:
   - **Username**: 5-25 characters
   - **Email**: Valid email format
   - **Password**: See security requirements above
3. Click **Register**
4. On success, you'll be redirected to the login page

### Login

1. Go to http://localhost:5173/login
2. Enter your **email or username** and **password**
3. JWT token is stored in localStorage (expires after 6 hours)
4. You'll be redirected to the File Manager

### File Manager

**User Profile:**
- Click your profile picture to change it (any image type, max 5MB)

**File Actions:**
- **Upload File**: `.txt`, `.html`, `.md`, `.pdf`, `.docx` (DOCX auto-converts to Editor.js format)
- **Upload Image**: Any image format
- **New Document**: Create a blank document with a custom name
- **New Folder**: Create folders to organize your files

**Tabs:**
- **My Files**: View files and folders in the current directory
- **Recycle Bin**: Soft-deleted files (can restore or permanently delete)

**File Operations:**
- **Rename** (without extension, automatically set to `.txt`)
- **Clone**: Create a duplicate
- **Move to Folder**: Change file location (owner only)
- **Share**: Open sharing dialog
- **Move to Trash**: Soft-delete (owner only)

**Search & Sort:**
- Search by keyword
- Sort by Name, Created Date, or Modified Date
- Toggle ascending/descending order

### Document Editor

**Editing Workflow:**
1. Click on a file to open the document editor
2. Editor automatically requests a lock
3. Heartbeat sent every 5 seconds to maintain the lock
4. Make your changes using the rich text editor
5. Click **Save** to save and release the lock

**If Document is Locked:**
- You'll see: "This document is currently being edited by [username]"
- You're placed in a FIFO queue
- Your queue position is displayed
- When it's your turn, you'll be notified

**Editor Tools:**
- **Undo/Redo**: Ctrl+Z / Ctrl+Y or toolbar buttons
- **Share**: Open sharing dialog
- **Download PDF**: Generate formatted PDF
- **Comments**: Open comments panel
- **Save**: Save changes and return to file manager
- **Force Unlock**: (Owner only) Release any lock

### Sharing Documents

**Grant Edit Access:**
1. Click **Share** button
2. Enter the email or username
3. Click **Share**
4. User will see the file with a "Shared (Editor)" badge

**Create View-Only Link:**
1. Click **Generate Link**
2. Copy the public URL (http://localhost:5173/share/<token>)
3. Anyone with the link can view (but not edit) the document

**Manage Permissions:**
- View list of people with access
- Remove permissions at any time

### Comments

**Adding a Comment:**
1. Select text in the editor
2. Right-click on selected text
3. Click **Add Comment**
4. Type your comment and click **Post**

**Managing Comments:**
- View **Active** or **Resolved** comments
- **Resolve**: Mark as resolved
- **Reopen**: Bring back from resolved
- **Delete**: Remove comment

### Internationalization

- Use the language selector in the navigation bar
- Supported languages: English, Finnish, Romanian, Russian, Polish
- Language choice persists in localStorage
- Auto-detects browser language on first visit

---

## 🏗️ Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework |
| TypeScript | 5.9.3 | Static typing |
| Vite | 7.3.1 | Development server & bundler |
| React Router DOM | 7.13.0 | Client-side routing |
| Material UI (MUI) | 7.3.8 | Component library & theming |
| Editor.js | 2.31.3 | Block-style rich-text editor |
| jsPDF | 4.2.0 | PDF generation |
| jwt-decode | 4.0.0 | JWT token decoding |
| i18next | 25.8.13 | Internationalization |
| Vitest | 4.0.18 | Unit testing framework |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18.x+ | JavaScript runtime |
| Express | 5.2.1 | Web framework |
| TypeScript | 5.9.3 | Static typing |
| Mongoose | 9.2.1 | MongoDB ODM |
| MongoDB | 6.x+ | NoSQL database |
| jsonwebtoken | 9.0.3 | JWT authentication |
| bcryptjs | 3.0.3 | Password hashing |
| express-validator | 7.3.1 | Input validation |
| Multer | 2.0.2 | File upload handling |
| pdf-parse | 2.4.5 | PDF text extraction |
| mammoth | 1.11.0 | DOCX HTML extraction |
| cheerio | 1.2.0 | HTML parsing |

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive JWT

### User Management
- `GET /api/users/me` - Get current user info
- `POST /api/users/profile-picture` - Upload profile picture
- `GET /api/users/search` - Search for users

### File Operations
- `GET /api/files` - List all files
- `POST /api/files/upload` - Upload document
- `POST /api/files/upload-image` - Upload image
- `POST /api/files/create-blank` - Create blank document
- `GET /api/files/:id/content` - Get file content
- `PUT /api/files/:id/content` - Save file content
- `PUT /api/files/:id` - Rename file
- `DELETE /api/files/:id` - Move to trash
- `PUT /api/files/:id/restore` - Restore from trash
- `DELETE /api/files/:id/permanent` - Permanent delete
- `POST /api/files/:id/clone` - Clone file
- `PUT /api/files/:id/move` - Move file to folder

### Trash Management
- `GET /api/files/trash/list` - List trashed files
- `DELETE /api/files/trash/empty` - Empty trash

### Sharing
- `POST /api/files/:id/share/edit` - Grant edit access
- `POST /api/files/:id/share/view-link` - Create view-only link
- `GET /api/files/:id/permissions` - List permissions
- `DELETE /api/files/:id/permissions/:permissionId` - Remove permission
- `GET /api/files/shared/:token` - View shared file

### Document Locking
- `POST /api/files/:id/lock` - Acquire lock
- `PUT /api/files/:id/lock` - Renew lock (heartbeat)
- `DELETE /api/files/:id/lock` - Release lock
- `GET /api/files/:id/lock-status` - Get lock status
- `POST /api/files/:id/force-unlock` - Force unlock (owner only)
- `DELETE /api/files/:id/queue` - Leave waiting queue

### Comments
- `GET /api/files/:id/comments` - List comments
- `POST /api/files/:id/comments` - Add comment
- `PUT /api/files/:id/comments/:commentId/resolve` - Resolve comment
- `DELETE /api/files/:id/comments/:commentId` - Delete comment

### Folders
- `POST /api/folders` - Create folder
- `GET /api/folders` - List folders
- `DELETE /api/folders/:id` - Delete folder

---

## 🎯 Key Features Explained

### Document Locking System

The locking system ensures that only one user can edit a document at a time:

1. **Acquire Lock**: User opens document → receives editing lock
2. **Heartbeat**: Client sends heartbeat every 5 seconds
3. **Inactivity Timeout**: Lock released after 5 minutes of inactivity
4. **Queue System**: Other users join FIFO queue
5. **Grace Period**: 30-second countdown when editor leaves (prevents accidental loss of turn)
6. **Force Unlock**: Owner can override any lock
7. **Server Restart**: All locks cleared on server startup

### File Upload & Conversion

- **Supported formats**: `.txt`, `.html`, `.md`, `.pdf`, `.docx`
- **DOCX files**: Automatically converted to Editor.js format
  - Preserves tables, lists, headers, and formatting
  - Uses mammoth for HTML extraction
  - Cheerio parses HTML into Editor.js blocks
- **PDF files**: Text extraction using pdf-parse
- **Images**: Any image format accepted

---

## 📦 Project Structure

```
cloud-drive/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── i18n/          # Translation files
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── models/        # Mongoose models
│   │   ├── middleware/    # Auth & validation
│   │   └── ...
│   ├── package.json
│   └── tsconfig.json
└── package.json           # Root package (scripts)
```
## 📄 License

This project is licensed under the MIT License.

---

## 🐛 Troubleshooting

**MongoDB Connection Issues:**
- Ensure MongoDB is running: `mongod` or `brew services start mongodb-community`
- Verify connection string: `mongodb://127.0.0.1:27017/testdb`

**Port Already in Use:**
- Frontend (5173): Check for other Vite instances
- Backend (3000): Check for other Node processes

**JWT Token Expired:**
- Tokens expire after 6 hours
- Simply log in again to receive a new token

**File Lock Issues:**
- Restart the server to clear all locks
- Use Force Unlock if you're the file owner
