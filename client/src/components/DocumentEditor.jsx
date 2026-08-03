import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { 
  ArrowLeft, Users, Share2, Save, Check, History, 
  Clock, RotateCcw, Eye, X, Plus, MapPin, 
  MessageSquare, Send, CheckCircle, Trash2, Shield, Edit3, MessageCircle, AlertCircle,
  ChevronDown, Lock
} from 'lucide-react';
import QuillCursors from 'quill-cursors';
import { format, formatDistanceToNow } from 'date-fns';

Quill.register('modules/cursors', QuillCursors);

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'image'],
  ['clean'],
];

const DocumentEditor = () => {
  const { id: documentId } = useParams();
  const { token, user, api } = useAuth();
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);
  const [documentInfo, setDocumentInfo] = useState(null);
  const [userRole, setUserRole] = useState('VIEWER');
  const [title, setTitle] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  // Google Docs Mode Selector State (EDITING | SUGGESTING | VIEWING)
  const [editorMode, setEditorMode] = useState('EDITING');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  
  // Sharing state
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('EDITOR');
  const [collaborators, setCollaborators] = useState([]);
  const [loadingCollabs, setLoadingCollabs] = useState(false);

  // Drawers state
  const [showPresenceDrawer, setShowPresenceDrawer] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  const [showCommentDrawer, setShowCommentDrawer] = useState(false);

  // Version History state
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState(null);

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);

  const navigate = useNavigate();
  const cursorsRef = useRef(null);

  // Sync mode with user permissions when role loads
  useEffect(() => {
    if (userRole === 'VIEWER') {
      setEditorMode('VIEWING');
    } else if (userRole === 'COMMENTER') {
      setEditorMode('SUGGESTING');
    } else {
      setEditorMode('EDITING');
    }
  }, [userRole]);

  // Initialize socket & fetch info
  useEffect(() => {
    fetchDocInfo();
    const s = io('http://localhost:3001');
    setSocket(s);

    s.emit('get-document', { documentId, token });

    return () => {
      s.disconnect();
    };
  }, [documentId, token]);

  const fetchDocInfo = async () => {
    try {
      const res = await api.get(`/documents/${documentId}`);
      setDocumentInfo(res.data.document);
      setUserRole(res.data.role);
      setTitle(res.data.document.title);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const fetchCollaborators = async () => {
    setLoadingCollabs(true);
    try {
      const res = await api.get(`/documents/${documentId}/collaborators`);
      setCollaborators(res.data.collaborators || []);
    } catch (err) {
      console.error('Failed to fetch collaborators', err);
    } finally {
      setLoadingCollabs(false);
    }
  };

  const fetchVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.get(`/documents/${documentId}/versions`);
      setVersions(res.data);
    } catch (err) {
      console.error('Failed to fetch versions', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/documents/${documentId}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (showShare) fetchCollaborators();
  }, [showShare]);

  useEffect(() => {
    if (showVersionDrawer) fetchVersions();
  }, [showVersionDrawer]);

  useEffect(() => {
    if (showCommentDrawer) fetchComments();
  }, [showCommentDrawer]);

  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = '';
    const editor = document.createElement('div');
    wrapper.append(editor);
    const q = new Quill(editor, {
      theme: 'snow',
      modules: { 
        toolbar: TOOLBAR_OPTIONS,
        cursors: true
      },
    });
    setQuill(q);
    cursorsRef.current = q.getModule('cursors');
  }, []);

  // Enable/Disable editor based on mode, role, and preview state
  useEffect(() => {
    if (!quill) return;

    if (editorMode === 'EDITING' && (userRole === 'OWNER' || userRole === 'EDITOR') && !previewVersion) {
      quill.enable();
    } else {
      quill.disable();
    }

    if (editorMode === 'SUGGESTING') {
      setShowCommentDrawer(true);
    }
  }, [quill, editorMode, userRole, previewVersion]);

  // Text change handler for socket sync (only in EDITING mode for OWNER & EDITOR)
  useEffect(() => {
    if (socket == null || quill == null || previewVersion) return;
    if (userRole !== 'OWNER' && userRole !== 'EDITOR') return;
    if (editorMode !== 'EDITING') return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socket.emit('send-changes', delta);
      
      setSaving(true);
      setTimeout(() => {
        socket.emit('save-document', quill.root.innerHTML);
        setSaving(false);
      }, 1000);
    };
    quill.on('text-change', handler);

    return () => {
      quill.off('text-change', handler);
    };
  }, [socket, quill, previewVersion, userRole, editorMode]);

  // Socket event listeners
  useEffect(() => {
    if (socket == null || quill == null) return;

    const changesHandler = (delta) => {
      if (!previewVersion) {
        quill.updateContents(delta);
      }
    };
    socket.on('receive-changes', changesHandler);

    socket.on('load-document', ({ content, role }) => {
      quill.root.innerHTML = content || '';
      setUserRole(role);
    });

    socket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    socket.on('receive-cursor', (data) => {
      if (!cursorsRef.current) return;
      if (data.id === user.id) return;

      cursorsRef.current.createCursor(data.id, data.name, data.color);
      cursorsRef.current.moveCursor(data.id, data.range);
    });

    socket.on('version-created', (newVer) => {
      setVersions(prev => [newVer, ...prev.filter(v => v.id !== newVer.id)]);
    });

    socket.on('document-restored', ({ content }) => {
      if (quill) {
        quill.root.innerHTML = content || '';
        setPreviewVersion(null);
      }
      fetchVersions();
    });

    socket.on('comment-added', () => fetchComments());
    socket.on('comment-resolved', () => fetchComments());
    socket.on('comment-deleted', () => fetchComments());

    return () => {
      socket.off('receive-changes', changesHandler);
      socket.off('load-document');
      socket.off('active-users');
      socket.off('receive-cursor');
      socket.off('version-created');
      socket.off('document-restored');
      socket.off('comment-added');
      socket.off('comment-resolved');
      socket.off('comment-deleted');
    };
  }, [socket, quill, previewVersion, user.id]);

  // Cursor selection tracking
  useEffect(() => {
    if (socket == null || quill == null) return;

    const cursorHandler = (range, oldRange, source) => {
      if (source === 'user') {
        let activeLoc = 'Viewing document';
        if (range) {
          const textBefore = quill.getText(0, range.index);
          const lineNumber = textBefore.split('\n').length;
          if (range.length > 0) {
            activeLoc = `Line ${lineNumber} (Selecting ${range.length} chars)`;
          } else {
            activeLoc = `Line ${lineNumber}`;
          }
        }

        socket.emit('cursor-move', {
          range,
          activeLocation: activeLoc
        });
      }
    };
    quill.on('selection-change', cursorHandler);

    return () => quill.off('selection-change', cursorHandler);
  }, [socket, quill]);

  // Update Title
  const handleTitleBlur = async () => {
    if (userRole !== 'OWNER' && userRole !== 'EDITOR') return;
    if (title.trim() && title !== documentInfo?.title) {
      try {
        await api.put(`/documents/${documentId}`, { title: title.trim() });
        setDocumentInfo(prev => ({ ...prev, title: title.trim() }));
      } catch (err) {
        console.error('Failed to update title', err);
      }
    }
  };

  // Share handler
  const handleShare = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/documents/${documentId}/share`, { email: shareEmail, role: shareRole });
      alert(`Document shared successfully with ${shareEmail} as ${shareRole}!`);
      setShareEmail('');
      fetchCollaborators();
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'Failed to share';
      if (errorMsg === 'User not found') {
        errorMsg = 'User not found! They must create an account on SyncWrite first.';
      }
      alert(errorMsg);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (collabUserId) => {
    if (!window.confirm('Are you sure you want to remove this collaborator?')) return;
    try {
      await api.delete(`/documents/${documentId}/collaborators/${collabUserId}`);
      fetchCollaborators();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove collaborator');
    }
  };

  // Comments handlers
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    if (userRole === 'VIEWER') {
      alert('Viewers are not permitted to add comments.');
      return;
    }

    try {
      await api.post(`/documents/${documentId}/comments`, { content: newCommentText.trim() });
      setNewCommentText('');
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post comment');
    }
  };

  const handleAddReply = async (parentId) => {
    const text = replyTextMap[parentId];
    if (!text || !text.trim()) return;
    if (userRole === 'VIEWER') {
      alert('Viewers are not permitted to reply to comments.');
      return;
    }

    try {
      await api.post(`/documents/${documentId}/comments`, { content: text.trim(), parentId });
      setReplyTextMap(prev => ({ ...prev, [parentId]: '' }));
      setActiveReplyId(null);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post reply');
    }
  };

  const handleToggleResolveComment = async (commentId) => {
    if (userRole === 'VIEWER') return;
    try {
      await api.put(`/documents/${documentId}/comments/${commentId}/resolve`);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resolve comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await api.delete(`/documents/${documentId}/comments/${commentId}`);
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete comment');
    }
  };

  // Create manual snapshot version
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!quill) return;
    if (userRole !== 'OWNER' && userRole !== 'EDITOR') {
      alert('Viewers and commenters cannot create version snapshots.');
      return;
    }
    
    try {
      setIsCreatingSnapshot(true);
      const res = await api.post(`/documents/${documentId}/versions`, {
        versionName: snapshotName.trim() || 'Manual Snapshot',
        content: quill.root.innerHTML
      });
      setVersions(prev => [res.data, ...prev]);
      setSnapshotName('');
      alert('Version snapshot saved successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handlePreviewVersion = (ver) => {
    setPreviewVersion(ver);
    if (quill) {
      quill.root.innerHTML = ver.content;
      quill.disable();
    }
  };

  const handleExitPreview = () => {
    setPreviewVersion(null);
    if (quill && socket) {
      socket.emit('get-document', { documentId, token });
    }
  };

  const handleRestoreVersion = async (verId) => {
    if (userRole !== 'OWNER' && userRole !== 'EDITOR') {
      alert('Only owner or editors can restore document versions.');
      return;
    }

    if (!window.confirm('Are you sure you want to restore this version? Current document content will be replaced.')) {
      return;
    }

    try {
      setRestoringVersionId(verId);
      const res = await api.post(`/documents/${documentId}/versions/${verId}/restore`);
      if (quill) {
        quill.root.innerHTML = res.data.document.content;
      }
      setPreviewVersion(null);
      fetchVersions();
      alert('Version restored successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restore version');
    } finally {
      setRestoringVersionId(null);
    }
  };

  const handleJumpToUserCursor = (u) => {
    if (u.cursor && quill) {
      quill.setSelection(u.cursor.index, u.cursor.length || 0);
      quill.focus();
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'OWNER':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><Shield size={12} className="mr-1" /> Owner</span>;
      case 'EDITOR':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><Edit3 size={12} className="mr-1" /> Editor</span>;
      case 'COMMENTER':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"><MessageCircle size={12} className="mr-1" /> Commenter</span>;
      case 'VIEWER':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700"><Eye size={12} className="mr-1" /> Viewer</span>;
    }
  };

  // Google Docs Mode Selector UI config
  const getModeInfo = (mode) => {
    switch (mode) {
      case 'EDITING':
        return { label: 'Editing', icon: <Edit3 size={16} className="text-blue-600 mr-2" />, sub: 'Edit document directly' };
      case 'SUGGESTING':
        return { label: 'Suggesting', icon: <MessageSquare size={16} className="text-amber-600 mr-2" />, sub: 'Edits become comments & suggestions' };
      case 'VIEWING':
      default:
        return { label: 'Viewing', icon: <Eye size={16} className="text-gray-600 mr-2" />, sub: 'Read or print final document' };
    }
  };

  if (!documentInfo) return <div className="p-10 text-center text-gray-500 font-sans">Loading...</div>;

  const currentModeInfo = getModeInfo(editorMode);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-2 flex items-center justify-between z-50 relative">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')} 
            className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                disabled={userRole !== 'OWNER' && userRole !== 'EDITOR'}
                className={`text-lg font-semibold text-gray-900 border-b border-transparent focus:border-blue-500 bg-transparent focus:outline-none px-1.5 py-0.5 rounded transition-all ${
                  (userRole === 'OWNER' || userRole === 'EDITOR') ? 'hover:bg-gray-50' : 'cursor-not-allowed'
                }`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
              />
              {getRoleBadge(userRole)}
            </div>
            
            <div className="flex items-center text-xs text-gray-500 px-1.5 mt-0.5 space-x-2">
              {(userRole === 'OWNER' || userRole === 'EDITOR') && editorMode === 'EDITING' ? (
                saving ? (
                  <span className="flex items-center text-amber-600 font-medium">
                    <Save size={12} className="mr-1 animate-pulse" /> Saving changes...
                  </span>
                ) : (
                  <span className="flex items-center text-emerald-600 font-medium">
                    <Check size={12} className="mr-1" /> Saved to cloud
                  </span>
                )
              ) : (
                <span className="flex items-center text-gray-400 font-medium">
                  {editorMode === 'SUGGESTING' ? 'Suggesting Mode' : 'Read-Only Mode'}
                </span>
              )}
              <span>•</span>
              <span className="text-gray-400">By {documentInfo.Owner?.name}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Invisible Backdrop to close dropdowns when clicking anywhere outside */}
          {(showModeDropdown || showShare) && (
            <div 
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => {
                setShowModeDropdown(false);
                setShowShare(false);
              }}
            />
          )}

          {/* Active Collaborators Avatar Stack */}
          <div 
            onClick={() => { 
              setShowPresenceDrawer(!showPresenceDrawer); 
              setShowVersionDrawer(false); 
              setShowCommentDrawer(false);
              setShowModeDropdown(false);
              setShowShare(false);
            }}
            className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            title="Click to view Active Collaborators Presence"
          >
            <div className="flex items-center -space-x-2">
              {activeUsers.map((u) => (
                <div key={u.id} className="relative group">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
              ))}
            </div>
            <div className="flex items-center text-xs font-medium text-gray-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              {activeUsers.length} Online
            </div>
          </div>

          {/* Comments Toggle Button */}
          <button
            onClick={() => { 
              setShowCommentDrawer(!showCommentDrawer); 
              setShowVersionDrawer(false); 
              setShowPresenceDrawer(false);
              setShowModeDropdown(false);
              setShowShare(false);
            }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showCommentDrawer 
                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <MessageSquare size={16} className="mr-1.5 text-blue-600" />
            Comments
          </button>

          {/* Version History Toggle Button */}
          <button
            onClick={() => { 
              setShowVersionDrawer(!showVersionDrawer); 
              setShowPresenceDrawer(false); 
              setShowCommentDrawer(false);
              setShowModeDropdown(false);
              setShowShare(false);
            }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showVersionDrawer 
                ? 'bg-purple-100 text-purple-700 border-purple-300' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <History size={16} className="mr-1.5 text-purple-600" />
            History
          </button>

          {/* Google Docs Style Mode Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowModeDropdown(!showModeDropdown);
                setShowShare(false);
              }}
              className="flex items-center bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
              title="Change Editor Mode"
            >
              {currentModeInfo.icon}
              <span>{currentModeInfo.label}</span>
              <ChevronDown size={15} className="ml-1.5 text-gray-500" />
            </button>

            {showModeDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-[100] animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Select Editing Mode
                </div>

                {/* Editing Option */}
                <button
                  onClick={() => {
                    if (userRole === 'OWNER' || userRole === 'EDITOR') {
                      setEditorMode('EDITING');
                      setShowModeDropdown(false);
                    }
                  }}
                  disabled={userRole !== 'OWNER' && userRole !== 'EDITOR'}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors ${
                    editorMode === 'EDITING' ? 'bg-blue-50/70 border border-blue-200' : 'hover:bg-gray-50'
                  } ${(userRole !== 'OWNER' && userRole !== 'EDITOR') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Edit3 size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-gray-900 flex justify-between items-center">
                      <span>Editing</span>
                      {editorMode === 'EDITING' && <Check size={14} className="text-blue-600 font-bold" />}
                      {(userRole !== 'OWNER' && userRole !== 'EDITOR') && <Lock size={12} className="text-gray-400" />}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Edit document directly</div>
                  </div>
                </button>

                {/* Suggesting Option */}
                <button
                  onClick={() => {
                    if (userRole !== 'VIEWER') {
                      setEditorMode('SUGGESTING');
                      setShowModeDropdown(false);
                    }
                  }}
                  disabled={userRole === 'VIEWER'}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors ${
                    editorMode === 'SUGGESTING' ? 'bg-amber-50/70 border border-amber-200' : 'hover:bg-gray-50'
                  } ${userRole === 'VIEWER' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <MessageSquare size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-gray-900 flex justify-between items-center">
                      <span>Suggesting</span>
                      {editorMode === 'SUGGESTING' && <Check size={14} className="text-amber-600 font-bold" />}
                      {userRole === 'VIEWER' && <Lock size={12} className="text-gray-400" />}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Edits become comments & suggestions</div>
                  </div>
                </button>

                {/* Viewing Option */}
                <button
                  onClick={() => {
                    setEditorMode('VIEWING');
                    setShowModeDropdown(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors ${
                    editorMode === 'VIEWING' ? 'bg-gray-100 border border-gray-300' : 'hover:bg-gray-50'
                  } cursor-pointer`}
                >
                  <Eye size={18} className="text-gray-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs text-gray-900 flex justify-between items-center">
                      <span>Viewing</span>
                      {editorMode === 'VIEWING' && <Check size={14} className="text-gray-800 font-bold" />}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Read or print final document</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Share & Permissions Button */}
          <div className="relative">
            <button 
              onClick={() => setShowShare(!showShare)}
              className="flex items-center bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Share2 size={15} className="mr-1.5" /> Share
            </button>
            
            {showShare && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-base flex items-center">
                    <Share2 size={18} className="mr-2 text-blue-600" /> Document Sharing & Permissions
                  </h3>
                  <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>

                {/* Invite / Add Collaborator */}
                {(userRole === 'OWNER' || userRole === 'EDITOR') ? (
                  <form onSubmit={handleShare} className="mb-5 space-y-3 pb-4 border-b border-gray-100">
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Invite Collaborator
                    </label>
                    <div className="flex space-x-2">
                      <input 
                        type="email" 
                        required 
                        placeholder="User's email address..." 
                        className="flex-1 p-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                        value={shareEmail}
                        onChange={e => setShareEmail(e.target.value)}
                      />
                      <select
                        value={shareRole}
                        onChange={e => setShareRole(e.target.value)}
                        className="p-2 border border-gray-300 rounded-lg text-xs font-medium bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="COMMENTER">Commenter</option>
                        <option value="VIEWER">Viewer</option>
                      </select>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                      Send Invitation / Update Permission
                    </button>
                  </form>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 mb-4">
                    Only Owner and Editors can invite or update sharing permissions.
                  </div>
                )}

                {/* Collaborators List */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                    People with Access
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2.5">
                    {/* Owner Card */}
                    <div className="flex items-center justify-between p-2.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                          {documentInfo.Owner?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{documentInfo.Owner?.name}</div>
                          <div className="text-[11px] text-gray-500">{documentInfo.Owner?.email}</div>
                        </div>
                      </div>
                      <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full text-[10px]">Owner</span>
                    </div>

                    {/* Shared Collaborators */}
                    {loadingCollabs ? (
                      <div className="text-center py-4 text-xs text-gray-400">Loading collaborators...</div>
                    ) : collaborators.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-400">Not shared with anyone else yet.</div>
                    ) : (
                      collaborators.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-gray-600 text-white font-bold flex items-center justify-center">
                              {c.User?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{c.User?.name}</div>
                              <div className="text-[11px] text-gray-500">{c.User?.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {getRoleBadge(c.role)}
                            {userRole === 'OWNER' && (
                              <button 
                                onClick={() => handleRemoveCollaborator(c.userId)}
                                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded" 
                                title="Remove Access"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Area */}
        <main className="flex-1 overflow-auto bg-gray-100 p-4 sm:p-8 flex flex-col items-center">
          {/* Permission Mode Banner */}
          {editorMode === 'SUGGESTING' && (
            <div className="w-full max-w-4xl bg-amber-500 text-white px-5 py-2.5 rounded-xl mb-4 shadow-md flex items-center space-x-2 text-xs font-medium animate-in fade-in">
              <MessageCircle size={16} />
              <span><strong>Suggesting Mode:</strong> You can view the document and post comments/replies. Direct text editing is disabled.</span>
            </div>
          )}

          {editorMode === 'VIEWING' && (
            <div className="w-full max-w-4xl bg-gray-600 text-white px-5 py-2.5 rounded-xl mb-4 shadow-md flex items-center space-x-2 text-xs font-medium animate-in fade-in">
              <Eye size={16} />
              <span><strong>Viewing Mode:</strong> Read-only access. Document editing is disabled.</span>
            </div>
          )}

          {/* Banner when viewing Revision Preview */}
          {previewVersion && (
            <div className="w-full max-w-4xl bg-purple-900 text-white px-5 py-3 rounded-xl mb-4 shadow-lg flex justify-between items-center animate-in fade-in">
              <div className="flex items-center space-x-3">
                <Eye size={20} className="text-purple-300 animate-bounce" />
                <div>
                  <h4 className="font-semibold text-sm">
                    Previewing Historical Revision: "{previewVersion.versionName}"
                  </h4>
                  <p className="text-xs text-purple-200">
                    Created by {previewVersion.Creator?.name || 'Unknown'} on {format(new Date(previewVersion.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {(userRole === 'OWNER' || userRole === 'EDITOR') && (
                  <button
                    onClick={() => handleRestoreVersion(previewVersion.id)}
                    disabled={restoringVersionId === previewVersion.id}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                  >
                    <RotateCcw size={14} className="mr-1" /> Restore This Version
                  </button>
                )}
                <button
                  onClick={handleExitPreview}
                  className="bg-purple-800 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  Exit Preview
                </button>
              </div>
            </div>
          )}

          {/* Quill Editor Card */}
          <div className="w-full max-w-4xl bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200 min-h-[850px] flex flex-col">
            <div className="flex-1" ref={wrapperRef}></div>
          </div>
        </main>

        {/* Presence Awareness Side Drawer */}
        {showPresenceDrawer && (
          <aside className="w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-2">
                <Users size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-800 text-base">Active Collaborators</h3>
              </div>
              <button onClick={() => setShowPresenceDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Currently Viewing ({activeUsers.length})
              </div>

              {activeUsers.map((u) => (
                <div 
                  key={u.id}
                  className="p-3 bg-gray-50 hover:bg-blue-50/50 rounded-xl border border-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2.5">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                        style={{ backgroundColor: u.color }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900 flex items-center">
                          {u.name} {u.id === user.id && <span className="text-xs text-blue-600 ml-1 font-normal">(You)</span>}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                    
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping"></span>
                      Online
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs flex justify-between items-center">
                    <span className="text-gray-600 flex items-center">
                      <MapPin size={12} className="mr-1 text-gray-400" />
                      {u.activeLocation || 'Viewing document'}
                    </span>

                    {u.id !== user.id && u.cursor && (
                      <button
                        onClick={() => handleJumpToUserCursor(u)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-xs hover:underline flex items-center"
                      >
                        Jump to cursor
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Comments Side Drawer */}
        {showCommentDrawer && (
          <aside className="w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-2">
                <MessageSquare size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-800 text-base">Comments & Discussion</h3>
              </div>
              <button onClick={() => setShowCommentDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>

            {/* Post New Comment Input */}
            <div className="p-4 border-b border-gray-100 bg-blue-50/40">
              {userRole !== 'VIEWER' ? (
                <form onSubmit={handleAddComment} className="space-y-2">
                  <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider">
                    Add a Comment
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Write your comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 p-2 text-xs border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                    >
                      <Send size={13} className="mr-1" /> Post
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-xs text-gray-500 flex items-center space-x-1.5 p-1">
                  <AlertCircle size={14} className="text-gray-400" />
                  <span>Viewers cannot add or reply to comments.</span>
                </div>
              )}
            </div>

            {/* Comments Thread List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Comment Threads ({comments.length})
              </div>

              {loadingComments ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading comments...</div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No comments yet. Start a discussion!</div>
              ) : (
                comments.map((cmt) => (
                  <div
                    key={cmt.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      cmt.resolved ? 'bg-gray-50 border-gray-200 opacity-75' : 'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    {/* Top Level Comment Card */}
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                          {cmt.Author?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-900">{cmt.Author?.name}</div>
                          <div className="text-[10px] text-gray-400">
                            {formatDistanceToNow(new Date(cmt.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        {userRole !== 'VIEWER' && (
                          <button
                            onClick={() => handleToggleResolveComment(cmt.id)}
                            className={`p-1 rounded transition-colors ${
                              cmt.resolved ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-emerald-600'
                            }`}
                            title={cmt.resolved ? 'Mark unresolved' : 'Mark resolved'}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}

                        {(cmt.userId === user.id || userRole === 'OWNER') && (
                          <button
                            onClick={() => handleDeleteComment(cmt.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="Delete comment"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className={`text-xs text-gray-800 mb-2 leading-relaxed ${cmt.resolved ? 'line-through text-gray-500' : ''}`}>
                      {cmt.content}
                    </p>

                    {/* Nested Replies */}
                    {cmt.Replies && cmt.Replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-blue-100 space-y-2.5">
                        {cmt.Replies.map((r) => (
                          <div key={r.id} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold text-gray-900">{r.Author?.name}</span>
                              <div className="flex items-center space-x-1">
                                <span className="text-[10px] text-gray-400">
                                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                                </span>
                                {(r.userId === user.id || userRole === 'OWNER') && (
                                  <button
                                    onClick={() => handleDeleteComment(r.id)}
                                    className="text-gray-400 hover:text-red-600 p-0.5"
                                    title="Delete reply"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-gray-700">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Action */}
                    {userRole !== 'VIEWER' && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100">
                        {activeReplyId === cmt.id ? (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Write a reply..."
                              value={replyTextMap[cmt.id] || ''}
                              onChange={(e) => setReplyTextMap(prev => ({ ...prev, [cmt.id]: e.target.value }))}
                              className="flex-1 p-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => handleAddReply(cmt.id)}
                              className="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold hover:bg-blue-700"
                            >
                              Reply
                            </button>
                            <button
                              onClick={() => setActiveReplyId(null)}
                              className="text-gray-400 hover:text-gray-600 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveReplyId(cmt.id)}
                            className="text-xs text-blue-600 hover:underline font-medium flex items-center"
                          >
                            <MessageCircle size={12} className="mr-1" /> Reply
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Version History Side Drawer */}
        {showVersionDrawer && (
          <aside className="w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div className="flex items-center space-x-2">
                <History size={18} className="text-purple-600" />
                <h3 className="font-semibold text-gray-800 text-base">Version History</h3>
              </div>
              <button onClick={() => setShowVersionDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>

            {/* Create Snapshot Form */}
            {(userRole === 'OWNER' || userRole === 'EDITOR') && (
              <div className="p-4 border-b border-gray-100 bg-purple-50/50">
                <form onSubmit={handleCreateSnapshot} className="space-y-2">
                  <label className="block text-xs font-semibold text-purple-900 uppercase tracking-wider">
                    Save Version Snapshot
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Version name (e.g. Draft 1)"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      className="flex-1 p-2 text-xs border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingSnapshot}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                    >
                      <Plus size={14} className="mr-1" /> Save
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Revision List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Revisions ({versions.length})
              </div>

              {loadingVersions ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading revisions...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No revisions created yet.</div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      previewVersion?.id === ver.id
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                        : 'border-gray-200 hover:border-purple-300 bg-white hover:bg-purple-50/20'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">
                        {ver.versionName || 'Snapshot'}
                      </h4>
                      <span className="text-[11px] text-gray-400 flex items-center whitespace-nowrap">
                        <Clock size={11} className="mr-1" />
                        {formatDistanceToNow(new Date(ver.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-3 flex items-center">
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 font-bold flex items-center justify-center text-[10px] mr-1.5">
                        {ver.Creator?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                      <span>By <strong>{ver.Creator?.name || 'Unknown'}</strong></span>
                    </div>

                    <div className="text-[11px] text-gray-400 mb-3">
                      {format(new Date(ver.createdAt), 'MMM d, yyyy • h:mm:ss a')}
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => handlePreviewVersion(ver)}
                        className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
                      >
                        <Eye size={13} className="mr-1" /> Preview
                      </button>
                      {(userRole === 'OWNER' || userRole === 'EDITOR') && (
                        <button
                          onClick={() => handleRestoreVersion(ver.id)}
                          disabled={restoringVersionId === ver.id}
                          className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
                        >
                          <RotateCcw size={13} className="mr-1" /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      <style>{`
        .ql-container {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
        }
        .ql-toolbar {
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0 !important;
          padding: 12px 20px !important;
        }
        .ql-container.ql-snow {
          border: none !important;
        }
        .ql-editor {
          padding: 40px 60px !important;
          min-height: 800px;
        }
        .ql-cursor-flag {
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default DocumentEditor;
