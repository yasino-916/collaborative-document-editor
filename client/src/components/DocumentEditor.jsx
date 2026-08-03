import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { 
  ArrowLeft, Users, Share2, Save, Check, History, 
  Clock, RotateCcw, Eye, X, Sparkles, MapPin, Activity, AlertCircle, Plus 
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
  const [title, setTitle] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [showShare, setShowShare] = useState(false);
  
  // Side drawers state
  const [showPresenceDrawer, setShowPresenceDrawer] = useState(false);
  const [showVersionDrawer, setShowVersionDrawer] = useState(false);
  
  // Version History state
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(null);
  const [snapshotName, setSnapshotName] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState(null);

  const navigate = useNavigate();
  const cursorsRef = useRef(null);

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
      setTitle(res.data.document.title);
    } catch (err) {
      console.error(err);
      navigate('/');
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

  useEffect(() => {
    if (showVersionDrawer) {
      fetchVersions();
    }
  }, [showVersionDrawer]);

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

  // Text change handler for socket sync
  useEffect(() => {
    if (socket == null || quill == null || previewVersion) return;

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
  }, [socket, quill, previewVersion]);

  // Socket event listeners
  useEffect(() => {
    if (socket == null || quill == null) return;

    const changesHandler = (delta) => {
      if (!previewVersion) {
        quill.updateContents(delta);
      }
    };
    socket.on('receive-changes', changesHandler);

    socket.on('load-document', (docContent) => {
      quill.root.innerHTML = docContent || '';
      quill.enable();
    });

    socket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    socket.on('receive-cursor', (data) => {
      if (!cursorsRef.current) return;
      if (data.id === user.id) return; // Don't draw own cursor via socket

      cursorsRef.current.createCursor(data.id, data.name, data.color);
      cursorsRef.current.moveCursor(data.id, data.range);
    });

    socket.on('version-created', (newVer) => {
      setVersions(prev => [newVer, ...prev.filter(v => v.id !== newVer.id)]);
    });

    socket.on('document-restored', ({ content, restoredBy }) => {
      if (quill) {
        quill.root.innerHTML = content || '';
        setPreviewVersion(null);
      }
      fetchVersions();
    });

    return () => {
      socket.off('receive-changes', changesHandler);
      socket.off('load-document');
      socket.off('active-users');
      socket.off('receive-cursor');
      socket.off('version-created');
      socket.off('document-restored');
    };
  }, [socket, quill, previewVersion, user.id]);

  // Cursor selection tracking for Presence Active Location
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

  // Document Title update
  const handleTitleBlur = async () => {
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
      await api.post(`/documents/${documentId}/share`, { email: shareEmail, role: 'EDITOR' });
      alert('Document shared successfully!');
      setShareEmail('');
      setShowShare(false);
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'Failed to share';
      if (errorMsg === 'User not found') {
        errorMsg = 'User not found! They must create an account on SyncWrite first.';
      }
      alert(errorMsg);
    }
  };

  // Create manual snapshot version
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!quill) return;
    
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

  // Preview version revision
  const handlePreviewVersion = (ver) => {
    setPreviewVersion(ver);
    if (quill) {
      quill.root.innerHTML = ver.content;
      quill.disable();
    }
  };

  // Exit preview mode
  const handleExitPreview = () => {
    setPreviewVersion(null);
    if (quill && socket) {
      socket.emit('get-document', { documentId, token });
      quill.enable();
    }
  };

  // Restore version revision
  const handleRestoreVersion = async (verId) => {
    if (!window.confirm('Are you sure you want to restore this version? Current document content will be replaced.')) {
      return;
    }

    try {
      setRestoringVersionId(verId);
      const res = await api.post(`/documents/${documentId}/versions/${verId}/restore`);
      if (quill) {
        quill.root.innerHTML = res.data.document.content;
        quill.enable();
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

  // Jump cursor to active collaborator position
  const handleJumpToUserCursor = (u) => {
    if (u.cursor && quill) {
      quill.setSelection(u.cursor.index, u.cursor.length || 0);
      quill.focus();
    }
  };

  if (!documentInfo) return <div className="p-10 text-center text-gray-500">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden font-sans">
      {/* Top Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')} 
            className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-2 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-col">
            <input 
              type="text" 
              className="text-lg font-semibold text-gray-900 border-b border-transparent focus:border-blue-500 bg-transparent focus:outline-none focus:bg-gray-50 px-1.5 py-0.5 rounded transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
            />
            <div className="flex items-center text-xs text-gray-500 px-1.5 mt-0.5 space-x-2">
              {saving ? (
                <span className="flex items-center text-amber-600 font-medium">
                  <Save size={12} className="mr-1 animate-pulse" /> Saving changes...
                </span>
              ) : (
                <span className="flex items-center text-emerald-600 font-medium">
                  <Check size={12} className="mr-1" /> Saved to cloud
                </span>
              )}
              <span>•</span>
              <span className="text-gray-400">ID: {documentId.substring(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          {/* Active Collaborators Avatar Stack */}
          <div 
            onClick={() => { setShowPresenceDrawer(!showPresenceDrawer); setShowVersionDrawer(false); }}
            className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            title="Click to view Active Collaborators Presence"
          >
            <div className="flex items-center -space-x-2">
              {activeUsers.map((u) => (
                <div 
                  key={u.id} 
                  className="relative group"
                >
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

          {/* Version History Toggle Button */}
          <button
            onClick={() => { setShowVersionDrawer(!showVersionDrawer); setShowPresenceDrawer(false); }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showVersionDrawer 
                ? 'bg-purple-100 text-purple-700 border-purple-300' 
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <History size={16} className="mr-1.5 text-purple-600" />
            History
          </button>

          {/* Share Button */}
          <div className="relative">
            <button 
              onClick={() => setShowShare(!showShare)}
              className="flex items-center bg-blue-600 text-white hover:bg-blue-700 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <Share2 size={15} className="mr-1.5" /> Share
            </button>
            
            {showShare && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800 text-sm">Share Document</h3>
                  <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={handleShare}>
                  <input 
                    type="email" 
                    required 
                    placeholder="Enter user email..." 
                    className="w-full p-2 border border-gray-300 rounded-lg mb-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={shareEmail}
                    onChange={e => setShareEmail(e.target.value)}
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    Send Invite
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Editor Area */}
        <main className="flex-1 overflow-auto bg-gray-100 p-4 sm:p-8 flex flex-col items-center">
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
                <button
                  onClick={() => handleRestoreVersion(previewVersion.id)}
                  disabled={restoringVersionId === previewVersion.id}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                >
                  <RotateCcw size={14} className="mr-1" /> Restore This Version
                </button>
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
                      <button
                        onClick={() => handleRestoreVersion(ver.id)}
                        disabled={restoringVersionId === ver.id}
                        className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
                      >
                        <RotateCcw size={13} className="mr-1" /> Restore
                      </button>
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
