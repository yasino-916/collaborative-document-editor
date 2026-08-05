require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, Op, User, Document, Collaborator, DocumentVersion, Comment, Invitation } = require('./db');

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

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Returns { error } string if password fails strength rules, null if valid */
const validatePassword = (password) => {
  if (!password || password.length < 8)
    return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password))
    return 'Password must contain at least one uppercase letter';
  if (!/[a-z]/.test(password))
    return 'Password must contain at least one lowercase letter';
  if (!/[0-9]/.test(password))
    return 'Password must contain at least one number';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return 'Password must contain at least one special character (!@#$%^&*)';
  return null;
};

/** Consistent user shape returned in every auth response */
const formatUser = (user) => ({ id: user.id, name: user.name, email: user.email });

// ─────────────────────────────────────────────────────────────────────────────

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

// Helper to determine user role for a document
const getDocRole = async (documentId, userId) => {
  const document = await Document.findByPk(documentId, {
    include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'email'] }]
  });
  if (!document) return { document: null, role: null };
  
  if (document.ownerId === userId) {
    return { document, role: 'OWNER' };
  }

  const collab = await Collaborator.findOne({ where: { documentId, userId } });
  if (collab) {
    return { document, role: collab.role };
  }

  return { document, role: null }; // Unauthorized
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Email already in use' });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: formatUser(user) });
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
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;

    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch user info from Google');

    const payload = await response.json();

    let user = await User.findOne({ where: { email: payload.email } });
    if (!user) {
      const hashedPassword = await bcrypt.hash(Math.random().toString(36).slice(-8) + 'Aa1!', 10);
      user = await User.create({ name: payload.name, email: payload.email, password: hashedPassword });
    }

    const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token: jwtToken, user: formatUser(user) });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(401).json({ error: 'Invalid Google Token' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: formatUser(req.user) });
});

// Profile update routes
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existing = await User.findOne({ where: { email } });
      if (existing && existing.id !== req.user.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.email = email;
    }
    
    await req.user.update(updates);
    res.json({ message: 'Profile updated successfully', user: formatUser(req.user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Validate new password strength
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    // Ensure new password is different from current
    const isSame = await bcrypt.compare(newPassword, req.user.password);
    if (isSame) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await req.user.update({ password: hashedPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/account', authMiddleware, async (req, res) => {
  try {
    // Delete all documents owned by user
    await Document.destroy({ where: { ownerId: req.user.id } });
    
    // Delete all collaborations
    await Collaborator.destroy({ where: { userId: req.user.id } });
    
    // Delete all comments
    await Comment.destroy({ where: { userId: req.user.id } });
    
    // Delete user
    await req.user.destroy();
    
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Document Routes
app.get('/api/documents', authMiddleware, async (req, res) => {
  try {
    const ownedDocs = await Document.findAll({ 
      where: { ownerId: req.user.id },
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'] },
        { model: Collaborator, attributes: ['id', 'userId'] }
      ]
    });

    console.log(`[DOCS] Found ${ownedDocs.length} owned documents`);

    // Add hasCollaborators flag to owned docs
    const ownedDocsWithInfo = ownedDocs.map(doc => {
      const docJson = doc.toJSON();
      docJson.hasCollaborators = docJson.Collaborators && docJson.Collaborators.length > 0;
      docJson.collaboratorCount = docJson.Collaborators ? docJson.Collaborators.length : 0;
      delete docJson.Collaborators; // Remove the full list, just keep the count
      return docJson;
    });

    // Get documents where user is a collaborator
    const collabDocs = await Collaborator.findAll({
      where: { userId: req.user.id },
      include: [{
        model: Document,
        include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'email'] }]
      }]
    });

    const sharedDocs = collabDocs.map(c => c.Document);
    res.json({ ownedDocs: ownedDocsWithInfo, sharedDocs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const document = await Document.create({ title: title || 'Untitled Document', ownerId: req.user.id });
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || !role) return res.status(403).json({ error: 'Access denied' });

    const fullDoc = await Document.findByPk(req.params.id, {
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'email'] },
        { model: Collaborator, include: [{ model: User, attributes: ['id', 'name', 'email'] }] }
      ]
    });

    res.json({ document: fullDoc, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || (role !== 'OWNER' && role !== 'EDITOR')) {
      return res.status(403).json({ error: 'Access denied. Only owner or editor can rename' });
    }

    document.title = title;
    await document.save();
    res.json(document);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/duplicate', authMiddleware, async (req, res) => {
  try {
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || !role) return res.status(403).json({ error: 'Access denied' });

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
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || role !== 'OWNER') return res.status(403).json({ error: 'Only owner can delete document' });

    await document.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sharing & Collaborators Management
app.post('/api/documents/:id/share', authMiddleware, async (req, res) => {
  try {
    const { email, role } = req.body;

    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || (userRole !== 'OWNER' && userRole !== 'EDITOR'))
      return res.status(403).json({ error: 'Access denied. Only owner or editor can share.' });

    const validRoles = ['VIEWER', 'COMMENTER', 'EDITOR'];
    const targetRole = validRoles.includes(role) ? role : 'VIEWER';

    const userToShare = await User.findOne({ where: { email } });
    if (!userToShare) return res.status(404).json({ error: 'User not found' });
    if (userToShare.id === document.ownerId)
      return res.status(400).json({ error: 'Cannot share with document owner' });

    let collab = await Collaborator.findOne({ where: { documentId: document.id, userId: userToShare.id } });
    let isNewShare = false;

    if (collab) {
      collab.role = targetRole;
      await collab.save();
    } else {
      collab = await Collaborator.create({ documentId: document.id, userId: userToShare.id, role: targetRole });
      isNewShare = true;
    }

    io.emit('documentShared', {
      userId: userToShare.id,
      document: { id: document.id, title: document.title, Owner: { name: req.user.name, email: req.user.email } },
      sharedBy: req.user.name,
      role: targetRole,
      isNewShare
    });

    res.json({ message: `Shared successfully with ${userToShare.name} as ${targetRole}`, collab });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Invitation Routes ─────────────────────────────────────────────────────────

// POST /api/documents/:id/invite  — send an invitation (creates a PENDING record)
app.post('/api/documents/:id/invite', authMiddleware, async (req, res) => {
  try {
    const { email, role, message } = req.body;
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || (userRole !== 'OWNER' && userRole !== 'EDITOR'))
      return res.status(403).json({ error: 'Only owner or editor can send invitations.' });

    const validRoles = ['VIEWER', 'COMMENTER', 'EDITOR'];
    const targetRole = validRoles.includes(role) ? role : 'EDITOR';

    const invitee = await User.findOne({ where: { email } });
    if (!invitee) return res.status(404).json({ error: 'No user found with that email address.' });
    if (invitee.id === document.ownerId)
      return res.status(400).json({ error: 'Cannot invite the document owner.' });

    // If already a collaborator, just update role instead
    const existingCollab = await Collaborator.findOne({
      where: { documentId: document.id, userId: invitee.id }
    });
    if (existingCollab) {
      existingCollab.role = targetRole;
      await existingCollab.save();
      io.emit('documentShared', {
        userId: invitee.id,
        document: { id: document.id, title: document.title, Owner: { name: req.user.name, email: req.user.email } },
        sharedBy: req.user.name,
        role: targetRole,
        isNewShare: false
      });
      return res.json({ message: `${invitee.name} is already a collaborator. Role updated to ${targetRole}.` });
    }

    // Cancel any existing PENDING invite for same doc+invitee
    await Invitation.destroy({
      where: { documentId: document.id, inviteeId: invitee.id, status: 'PENDING' }
    });

    const invitation = await Invitation.create({
      documentId: document.id,
      inviterId: req.user.id,
      inviteeId: invitee.id,
      role: targetRole,
      status: 'PENDING',
      message: message || null
    });

    const fullInvitation = await Invitation.findByPk(invitation.id, {
      include: [
        { model: User, as: 'Inviter', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'Invitee', attributes: ['id', 'name', 'email'] },
        { model: Document, attributes: ['id', 'title'] }
      ]
    });

    // Notify the invitee in real-time
    io.emit('invitation-received', {
      userId: invitee.id,
      invitation: fullInvitation
    });

    res.json({ message: `Invitation sent to ${invitee.name}.`, invitation: fullInvitation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invitations  — get all pending invitations for the logged-in user
app.get('/api/invitations', authMiddleware, async (req, res) => {
  try {
    const invitations = await Invitation.findAll({
      where: { inviteeId: req.user.id, status: 'PENDING' },
      include: [
        { model: User, as: 'Inviter', attributes: ['id', 'name', 'email'] },
        { model: Document, attributes: ['id', 'title'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(invitations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invitations/count  — fast unread count for the bell badge
app.get('/api/invitations/count', authMiddleware, async (req, res) => {
  try {
    const count = await Invitation.count({
      where: { inviteeId: req.user.id, status: 'PENDING' }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invitations/:id/respond  — accept or reject
app.put('/api/invitations/:id/respond', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body; // 'ACCEPTED' | 'REJECTED'
    if (!['ACCEPTED', 'REJECTED'].includes(action))
      return res.status(400).json({ error: 'action must be ACCEPTED or REJECTED' });

    const invitation = await Invitation.findByPk(req.params.id, {
      include: [
        { model: User, as: 'Inviter', attributes: ['id', 'name', 'email'] },
        { model: Document, attributes: ['id', 'title'] }
      ]
    });

    if (!invitation) return res.status(404).json({ error: 'Invitation not found.' });
    if (invitation.inviteeId !== req.user.id)
      return res.status(403).json({ error: 'This invitation is not for you.' });
    if (invitation.status !== 'PENDING')
      return res.status(400).json({ error: 'Invitation has already been responded to.' });

    invitation.status = action;
    await invitation.save();

    if (action === 'ACCEPTED') {
      // Add as collaborator
      const [collab] = await Collaborator.findOrCreate({
        where: { documentId: invitation.documentId, userId: req.user.id },
        defaults: { role: invitation.role }
      });
      if (collab.role !== invitation.role) {
        collab.role = invitation.role;
        await collab.save();
      }

      // Notify inviter that the invitation was accepted
      io.emit('invitation-responded', {
        userId: invitation.inviterId,
        inviteeName: req.user.name,
        documentTitle: invitation.Document.title,
        documentId: invitation.documentId,
        action: 'ACCEPTED',
        role: invitation.role
      });

      // Also emit documentShared so Dashboard refreshes doc list
      io.emit('documentShared', {
        userId: req.user.id,
        document: { id: invitation.Document.id, title: invitation.Document.title },
        sharedBy: invitation.Inviter.name,
        role: invitation.role,
        isNewShare: true
      });
    } else {
      // Notify inviter of the rejection
      io.emit('invitation-responded', {
        userId: invitation.inviterId,
        inviteeName: req.user.name,
        documentTitle: invitation.Document.title,
        documentId: invitation.documentId,
        action: 'REJECTED'
      });
    }

    res.json({ message: `Invitation ${action.toLowerCase()}.`, invitation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id/collaborators', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });

    const collabs = await Collaborator.findAll({
      where: { documentId: req.params.id },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    res.json({ owner: document.Owner, collaborators: collabs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/collaborators', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || userRole !== 'OWNER') return res.status(403).json({ error: 'Only owner can add collaborators' });

    const { email, role = 'EDITOR' } = req.body;
    
    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found with this email' });

    // Don't allow owner to add themselves as collaborator
    if (user.id === document.ownerId) {
      return res.status(400).json({ error: 'Document owner cannot be added as collaborator' });
    }

    // Check if already a collaborator
    const existing = await Collaborator.findOne({ 
      where: { documentId: req.params.id, userId: user.id } 
    });
    if (existing) {
      return res.status(400).json({ error: 'User is already a collaborator' });
    }

    // Add collaborator
    const collaborator = await Collaborator.create({
      documentId: req.params.id,
      userId: user.id,
      role
    });

    const newCollab = await Collaborator.findByPk(collaborator.id, {
      include: [{ model: User, attributes: ['id', 'name', 'email'] }]
    });

    res.json({ message: 'Collaborator added successfully', collaborator: newCollab });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id/collaborators/:userId', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || userRole !== 'OWNER') return res.status(403).json({ error: 'Only owner can remove collaborators' });

    await Collaborator.destroy({ where: { documentId: req.params.id, userId: req.params.userId } });
    res.json({ message: 'Collaborator removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comments API Routes
app.get('/api/documents/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });

    const comments = await Comment.findAll({
      where: { documentId: req.params.id, parentId: null },
      include: [
        { model: User, as: 'Author', attributes: ['id', 'name', 'email'] },
        {
          model: Comment,
          as: 'Replies',
          include: [{ model: User, as: 'Author', attributes: ['id', 'name', 'email'] }],
          order: [['createdAt', 'ASC']]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });
    
    if (userRole === 'VIEWER') {
      return res.status(403).json({ error: 'Viewers are not permitted to add or reply to comments' });
    }

    const { content, parentId } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment content cannot be empty' });

    const comment = await Comment.create({
      documentId: document.id,
      userId: req.user.id,
      content: content.trim(),
      parentId: parentId || null
    });

    const fullComment = await Comment.findByPk(comment.id, {
      include: [
        { model: User, as: 'Author', attributes: ['id', 'name', 'email'] },
        {
          model: Comment,
          as: 'Replies',
          include: [{ model: User, as: 'Author', attributes: ['id', 'name', 'email'] }]
        }
      ]
    });

    io.to(document.id).emit('comment-added', fullComment);

    res.json(fullComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id/comments/:commentId/resolve', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });
    if (userRole === 'VIEWER') return res.status(403).json({ error: 'Viewers cannot resolve comments' });

    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment || comment.documentId !== document.id) return res.status(404).json({ error: 'Comment not found' });

    comment.resolved = !comment.resolved;
    await comment.save();

    io.to(document.id).emit('comment-resolved', { commentId: comment.id, resolved: comment.resolved });

    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/documents/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });

    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment || comment.documentId !== document.id) return res.status(404).json({ error: 'Comment not found' });

    if (comment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment content cannot be empty' });

    comment.content = content.trim();
    await comment.save();

    io.to(document.id).emit('comment-edited', { commentId: comment.id, content: comment.content });

    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/documents/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });

    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment || comment.documentId !== document.id) return res.status(404).json({ error: 'Comment not found' });

    const isCommentAuthor = comment.userId === req.user.id;
    const isDocOwner = document.ownerId === req.user.id;

    if (!isCommentAuthor && !isDocOwner) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await comment.destroy();

    io.to(document.id).emit('comment-deleted', { commentId: req.params.commentId });

    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Version History Routes
app.get('/api/documents/:id/versions', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || !userRole) return res.status(403).json({ error: 'Access denied' });

    const versions = await DocumentVersion.findAll({
      where: { documentId: req.params.id },
      include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/versions', authMiddleware, async (req, res) => {
  try {
    const { versionName, content } = req.body;
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || (userRole !== 'OWNER' && userRole !== 'EDITOR')) {
      return res.status(403).json({ error: 'Access denied. Viewers and commenters cannot create version snapshots.' });
    }

    const versionContent = content !== undefined ? content : document.content;

    const version = await DocumentVersion.create({
      documentId: document.id,
      content: versionContent,
      versionName: versionName || 'Manual Snapshot',
      createdBy: req.user.id
    });

    const fullVersion = await DocumentVersion.findByPk(version.id, {
      include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }]
    });

    io.to(document.id).emit('version-created', fullVersion);

    res.json(fullVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:id/versions/:versionId/restore', authMiddleware, async (req, res) => {
  try {
    const { document, role: userRole } = await getDocRole(req.params.id, req.user.id);
    if (!document || (userRole !== 'OWNER' && userRole !== 'EDITOR')) {
      return res.status(403).json({ error: 'Access denied. Only owner or editors can restore versions.' });
    }

    const versionToRestore = await DocumentVersion.findByPk(req.params.versionId);
    if (!versionToRestore || versionToRestore.documentId !== document.id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    await DocumentVersion.create({
      documentId: document.id,
      content: document.content,
      versionName: `Pre-restore Snapshot (${new Date().toLocaleTimeString()})`,
      createdBy: req.user.id
    });

    document.content = versionToRestore.content;
    await document.save();

    const restoreVersion = await DocumentVersion.create({
      documentId: document.id,
      content: versionToRestore.content,
      versionName: `Restored from "${versionToRestore.versionName || 'Revision'}"`,
      createdBy: req.user.id
    });

    const fullRestoreVersion = await DocumentVersion.findByPk(restoreVersion.id, {
      include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }]
    });

    io.to(document.id).emit('document-restored', {
      content: document.content,
      restoredBy: req.user.name,
      version: fullRestoreVersion
    });

    res.json({ message: 'Version restored', document, version: fullRestoreVersion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Routes (PDF and DOCX)
const { generatePDF, generateDOCX } = require('./exportService');

app.post('/api/documents/:id/export/pdf', authMiddleware, async (req, res) => {
  try {
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || !role) return res.status(403).json({ error: 'Access denied' });

    const { content } = req.body;
    const htmlContent = content || document.content;
    
    const pdfBuffer = await generatePDF(htmlContent, document.title);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.title || 'document'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Export Error:', err);
    res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
  }
});

app.post('/api/documents/:id/export/docx', authMiddleware, async (req, res) => {
  try {
    const { document, role } = await getDocRole(req.params.id, req.user.id);
    if (!document || !role) return res.status(403).json({ error: 'Access denied' });

    const { content } = req.body;
    const htmlContent = content || document.content;
    
    const docxBuffer = await generateDOCX(htmlContent, document.title);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${document.title || 'document'}.docx"`);
    res.send(docxBuffer);
  } catch (err) {
    console.error('DOCX Export Error:', err);
    res.status(500).json({ error: 'Failed to generate DOCX: ' + err.message });
  }
});

// Real-time Collaboration with Socket.IO
const activeUsers = new Map(); // docId -> Map(socketId -> { userId, name, color, status, activeLocation, cursor, role })
const lastVersionSaved = new Map();

const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#14B8A6'];

io.on('connection', (socket) => {
  socket.on('get-document', async ({ documentId, token }) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findByPk(decoded.userId);
      if (!user) return;

      const { document, role } = await getDocRole(documentId, user.id);
      if (!document || !role) {
        socket.emit('unauthorized', 'Access denied');
        return;
      }

      socket.join(documentId);
      socket.emit('load-document', { content: document.content, role });

      // Create initial version if none exist
      const existingVersionCount = await DocumentVersion.count({ where: { documentId } });
      if (existingVersionCount === 0 && document.content) {
        await DocumentVersion.create({
          documentId,
          content: document.content,
          versionName: 'Initial Version',
          createdBy: user.id
        });
      }

      if (!activeUsers.has(documentId)) {
        activeUsers.set(documentId, new Map());
      }
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      activeUsers.get(documentId).set(socket.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        color,
        role,
        status: 'online',
        activeLocation: 'Viewing document',
        cursor: null,
        joinedAt: new Date().toISOString()
      });
      
      const usersInRoom = Array.from(activeUsers.get(documentId).values());
      io.to(documentId).emit('active-users', usersInRoom);

      socket.on('send-changes', (delta) => {
        // Enforce role: Only OWNER or EDITOR can send document edits!
        if (role !== 'OWNER' && role !== 'EDITOR') return;
        socket.broadcast.to(documentId).emit('receive-changes', delta);
      });

      socket.on('cursor-move', (data) => {
        const room = activeUsers.get(documentId);
        if (room && room.has(socket.id)) {
          const userState = room.get(socket.id);
          userState.cursor = data.range;
          userState.activeLocation = data.activeLocation || 'Viewing document';
          userState.status = 'active';
        }

        socket.broadcast.to(documentId).emit('receive-cursor', {
          id: user.id,
          name: user.name,
          color,
          range: data.range,
          activeLocation: data.activeLocation
        });

        if (room) {
          io.to(documentId).emit('active-users', Array.from(room.values()));
        }
      });

      socket.on('typing', () => {
        if (role !== 'OWNER' && role !== 'EDITOR') return;
        socket.broadcast.to(documentId).emit('user-typing', { id: user.id, name: user.name });
      });

      socket.on('stop-typing', () => {
        socket.broadcast.to(documentId).emit('user-stopped-typing', { id: user.id });
      });

      socket.on('save-document', async (data) => {
        // Enforce role: Only OWNER or EDITOR can save document content!
        if (role !== 'OWNER' && role !== 'EDITOR') return;

        await Document.update({ content: data }, { where: { id: documentId } });

        // Notify all collaborators (not the editor themselves) that the document was changed
        const collabs = await Collaborator.findAll({ where: { documentId } });
        const changePayload = {
          documentId,
          documentTitle: document.title,
          changedBy: { id: user.id, name: user.name },
          changedAt: new Date().toISOString()
        };

        // Emit to every collaborator's personal channel
        collabs.forEach(c => {
          if (c.userId !== user.id) {
            io.emit('document-changed', { userId: c.userId, ...changePayload });
          }
        });

        // Also notify the owner if someone else is editing
        if (document.ownerId !== user.id) {
          io.emit('document-changed', { userId: document.ownerId, ...changePayload });
        }

        const now = Date.now();
        const lastSaved = lastVersionSaved.get(documentId) || 0;
        if (now - lastSaved > 2 * 60 * 1000) {
          const newVer = await DocumentVersion.create({
            documentId,
            content: data,
            versionName: 'Auto-saved Revision',
            createdBy: user.id
          });
          lastVersionSaved.set(documentId, now);

          const fullVer = await DocumentVersion.findByPk(newVer.id, {
            include: [{ model: User, as: 'Creator', attributes: ['id', 'name', 'email'] }]
          });
          io.to(documentId).emit('version-created', fullVer);
        }
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
}).catch((err) => {
  console.error('Database sync error:', err);
});
