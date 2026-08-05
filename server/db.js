const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production'
      ? { require: true, rejectUnauthorized: false }
      : false
  }
});

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
});

const Document = sequelize.define('Document', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: { type: DataTypes.STRING, defaultValue: 'Untitled Document' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  ownerId: { type: DataTypes.UUID, allowNull: false }
});

const Collaborator = sequelize.define('Collaborator', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  role: { type: DataTypes.ENUM('VIEWER', 'COMMENTER', 'EDITOR'), defaultValue: 'VIEWER' }
});

const DocumentVersion = sequelize.define('DocumentVersion', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  versionName: { type: DataTypes.STRING, defaultValue: 'Snapshot' }
});

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  resolved: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Invitation: tracks pending/accepted/rejected document share invitations
const Invitation = sequelize.define('Invitation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // Who is being invited
  inviteeId: { type: DataTypes.UUID, allowNull: false },
  // Who sent the invite
  inviterId: { type: DataTypes.UUID, allowNull: false },
  // Which document
  documentId: { type: DataTypes.UUID, allowNull: false },
  // What role is being offered
  role: { type: DataTypes.ENUM('VIEWER', 'COMMENTER', 'EDITOR'), defaultValue: 'EDITOR' },
  // Invitation state
  status: { type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED'), defaultValue: 'PENDING' },
  // Optional message from inviter
  message: { type: DataTypes.STRING, allowNull: true }
});

// Relationships
User.hasMany(Document, { foreignKey: 'ownerId' });
Document.belongsTo(User, { as: 'Owner', foreignKey: 'ownerId' });

Document.hasMany(Collaborator, { foreignKey: 'documentId' });
Collaborator.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(Collaborator, { foreignKey: 'userId' });
Collaborator.belongsTo(User, { foreignKey: 'userId' });

Document.hasMany(DocumentVersion, { foreignKey: 'documentId' });
DocumentVersion.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(DocumentVersion, { foreignKey: 'createdBy' });
DocumentVersion.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });

Document.hasMany(Comment, { foreignKey: 'documentId', onDelete: 'CASCADE' });
Comment.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { as: 'Author', foreignKey: 'userId' });

Comment.hasMany(Comment, { as: 'Replies', foreignKey: 'parentId', onDelete: 'CASCADE' });
Comment.belongsTo(Comment, { as: 'Parent', foreignKey: 'parentId' });

// Invitation relationships
User.hasMany(Invitation, { as: 'SentInvitations', foreignKey: 'inviterId' });
User.hasMany(Invitation, { as: 'ReceivedInvitations', foreignKey: 'inviteeId' });
Invitation.belongsTo(User, { as: 'Inviter', foreignKey: 'inviterId' });
Invitation.belongsTo(User, { as: 'Invitee', foreignKey: 'inviteeId' });
Document.hasMany(Invitation, { foreignKey: 'documentId', onDelete: 'CASCADE' });
Invitation.belongsTo(Document, { foreignKey: 'documentId' });

module.exports = {
  sequelize,
  Op,
  User,
  Document,
  Collaborator,
  DocumentVersion,
  Comment,
  Invitation
};
