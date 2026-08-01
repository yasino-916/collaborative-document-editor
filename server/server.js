require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Document, Collaborator, DocumentVersion, Comment } = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'syncwrite-super-secret-key-2026';

// Middleware for auth
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findByPk(decoded.userId);
    if (!req.user) throw new Error();
    
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

// Document Routes
app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const ownedDocs = await Document.findAll({ 
      where: { ownerId: req.user.id },
      include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'email'] }]
    });

    const collabDocs = await Collaborator.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Document,
        include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'email'] }]
      }]
    });

    const sharedDocs = collabDocs.map(c => c.Document);

    res.json({ ownedDocs, sharedDocs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const document = await Document.create({ title, ownerId: req.user.id });
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name'] },
        { model: Collaborator, include: [{ model: User, attributes: ['id', 'name', 'email'] }] }
      ]
    });

    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Check permissions
    const isOwner = document.ownerId === req.user.id;
    const collab = document.Collaborators.find(c => c.userId === req.user.id);
    
    if (!isOwner && !collab) return res.status(403).json({ error: 'Access denied' });

    res.json({ document, role: isOwner ? 'OWNER' : collab.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.user.id) return res.status(403).json({ error: 'Only owner can rename' });

    document.title = title;
    await document.save();
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    const isOwner = document.ownerId === req.user.id;
    const collab = await Collaborator.findOne({ where: { documentId: document.id, userId: req.user.id } });
    if (!isOwner && !collab) return res.status(403).json({ error: 'Access denied' });

    const duplicatedDoc = await Document.create({ 
      title: `${document.title} (Copy)`, 
      content: document.content,
      ownerId: req.user.id 
    });
    res.json(duplicatedDoc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    if (document.ownerId !== req.user.id) return res.status(403).json({ error: 'Only owner can delete' });

    await document.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/share', authMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;
    const document = await Document.findByPk(req.params.id);
    if (!document) return res.status(404).json({ error: 'Document not found' });
    
    // Only owner or EDITOR can share? Let's say only owner for simplicity
    if (document.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

    const userToShare = await User.findOne({ where: { email } });
    if (!userToShare) return res.status(404).json({ error: 'User not found' });

    if (userToShare.id === req.user.id) return res.status(400).json({ error: 'Cannot share with yourself' });

    const existingCollab = await Collaborator.findOne({ where: { documentId: document.id, userId: userToShare.id } });
    if (existingCollab) return res.status(400).json({ error: 'User is already a collaborator' });

    await Collaborator.create({ documentId: document.id, userId: userToShare.id, role });
    res.json({ message: 'Shared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Real-time Collaboration with Socket.IO
const activeUsers = new Map(); // docId -> Map(socketId -> { userId, name, color })

const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3', '#FFC733'];

io.on('connection', (socket) => {
  socket.on('get-document', async ({ documentId, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.userId);
      if (!user) return;

      socket.join(documentId);
      
      const document = await Document.findByPk(documentId);
      if (!document) return;

      socket.emit('load-document', document.content);

      if (!activeUsers.has(documentId)) {
        activeUsers.set(documentId, new Map());
      }
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      activeUsers.get(documentId).set(socket.id, { id: user.id, name: user.name, color });
      
      const usersInRoom = Array.from(activeUsers.get(documentId).values());
      io.to(documentId).emit('active-users', usersInRoom);

      socket.on('send-changes', (delta) => {
        socket.broadcast.to(documentId).emit('receive-changes', delta);
      });

      socket.on('cursor-move', (range) => {
        socket.broadcast.to(documentId).emit('receive-cursor', {
          id: user.id,
          name: user.name,
          color,
          range
        });
      });

      socket.on('save-document', async (data) => {
        await Document.update({ content: data }, { where: { id: documentId } });
        // Optionally save to DocumentVersion occasionally
      });

      socket.on('disconnect', () => {
        const roomUsers = activeUsers.get(documentId);
        if (roomUsers) {
          roomUsers.delete(socket.id);
          io.to(documentId).emit('active-users', Array.from(roomUsers.values()));
        }
      });

    } catch (err) {
      console.error(err);
    }
  });
});

const PORT = process.env.PORT || 3001;

sequelize.sync().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
