const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
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

Document.hasMany(Comment, { foreignKey: 'documentId' });
Comment.belongsTo(Document, { foreignKey: 'documentId' });

User.hasMany(Comment, { foreignKey: 'userId' });
Comment.belongsTo(User, { as: 'Author', foreignKey: 'userId' });

Comment.hasMany(Comment, { as: 'Replies', foreignKey: 'parentId' });

module.exports = {
  sequelize,
  User,
  Document,
  Collaborator,
  DocumentVersion,
  Comment
};
