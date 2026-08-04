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
  ChevronDown, Lock, Search, Download, Upload, Moon, Sun, Keyboard, Wifi, WifiOff, Bell, Settings, FileText, Image as ImageIcon
} from 'lucide-react';
import QuillCursors from 'quill-cursors';
import { format, formatDistanceToNow } from 'date-fns';
import html2pdf from 'html2pdf.js';
import pptxgen from 'pptxgenjs';
import mammoth from 'mammoth';

Quill.register('modules/cursors', QuillCursors);

const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['link', 'image'],
  ['clean'],
];

// Helper: Convert Quill HTML to Markdown
const htmlToMarkdown = (html) => {
  if (!html) return '';
  let md = html;
  md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<s>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<li>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<br\s*[\/]?>/gi, '\n');
  md = md.replace(/<[^>]+>/g, '');
  return md.trim();
};

// Helper: Convert Markdown to HTML
const markdownToHtml = (md) => {
  if (!md) return '';
  let html = md;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/gim, '<s>$1</s>');
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/\n$/gim, '<br />');
  const lines = html.split('\n');
  return lines.map(line => {
    if (line.startsWith('<h1>') || line.startsWith('<h2>') || line.startsWith('<h3>') || line.startsWith('<li>')) {
      return line;
    }
    return line.trim() ? `<p>${line}</p>` : '';
  }).join('');
};

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

  // Dark Mode
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Google Docs Mode Selector State (EDITING | SUGGESTING | VIEWING)
  const [editorMode, setEditorMode] = useState('EDITING');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // Offline Editing & Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasPendingOfflineSync, setHasPendingOfflineSync] = useState(false);

  // Typing Indicators State
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Search & Replace State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResultsCount, setSearchResultsCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Shortcuts Modal State
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  
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
  const [versionSearchQuery, setVersionSearchQuery] = useState('');

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTextMap, setReplyTextMap] = useState({});
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [editCommentId, setEditCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Notifications State (Toast stack)
  const [notifications, setNotifications] = useState([]);

  const navigate = useNavigate();
  const cursorsRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const addNotification = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }, []);

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

  // Dark mode effect
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addNotification('success', 'Network connection restored. Syncing changes...');
      syncOfflineChanges();
    };

    const handleOffline = () => {
      setIsOnline(false);
      addNotification('warning', 'You are offline. Edits are saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  // Sync offline changes when back online
  const syncOfflineChanges = async () => {
    const cachedContent = localStorage.getItem(`offline_doc_${documentId}`);
    if (cachedContent && quill) {
      try {
        await api.put(`/documents/${documentId}`, { content: cachedContent });
        if (socket) socket.emit('save-document', cachedContent);
        localStorage.removeItem(`offline_doc_${documentId}`);
        setHasPendingOfflineSync(false);
        addNotification('success', 'Offline changes successfully synced to cloud!');
      } catch (err) {
        console.error('Failed to sync offline edits', err);
      }
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        if (quill && (userRole === 'OWNER' || userRole === 'EDITOR')) {
          if (socket) socket.emit('save-document', quill.root.innerHTML);
          addNotification('success', 'Document manually saved!');
        }
      } else if (e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        setShowVersionDrawer(true);
        addNotification('info', 'Version History opened');
      } else if (e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        setShowSearch(prev => !prev);
      } else if (e.key.toLowerCase() === 'd' && e.shiftKey) {
        e.preventDefault();
        setIsDarkMode(prev => !prev);
      } else if (e.key.toLowerCase() === 'c' && e.shiftKey) {
        e.preventDefault();
        setShowCommentDrawer(prev => !prev);
      } else if (e.key.toLowerCase() === 'h' && e.shiftKey) {
        e.preventDefault();
        setShowVersionDrawer(prev => !prev);
      } else if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quill, userRole, socket, addNotification]);

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

  // Text change handler & typing indicator
  useEffect(() => {
    if (socket == null || quill == null || previewVersion) return;
    if (userRole !== 'OWNER' && userRole !== 'EDITOR') return;
    if (editorMode !== 'EDITING') return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;

      // Emit Typing Indicator
      socket.emit('typing');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop-typing');
      }, 1500);

      if (!navigator.onLine) {
        localStorage.setItem(`offline_doc_${documentId}`, quill.root.innerHTML);
        setHasPendingOfflineSync(true);
        return;
      }

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
  }, [socket, quill, previewVersion, userRole, editorMode, documentId]);

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
      // Check offline cache first
      const offlineContent = localStorage.getItem(`offline_doc_${documentId}`);
      if (offlineContent) {
        quill.root.innerHTML = offlineContent;
        setHasPendingOfflineSync(true);
      } else {
        quill.root.innerHTML = content || '';
      }
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

    socket.on('user-typing', ({ id, name }) => {
      if (id !== user.id) {
        setTypingUsers(prev => new Set(prev).add(name));
      }
    });

    socket.on('user-stopped-typing', ({ id }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        const userObj = activeUsers.find(u => u.id === id);
        if (userObj) next.delete(userObj.name);
        return next;
      });
    });

    socket.on('version-created', (newVer) => {
      setVersions(prev => [newVer, ...prev.filter(v => v.id !== newVer.id)]);
      addNotification('info', `New version snapshot: "${newVer.versionName}"`);
    });

    socket.on('document-restored', ({ content, restoredBy }) => {
      if (quill) {
        quill.root.innerHTML = content || '';
        setPreviewVersion(null);
      }
      fetchVersions();
      addNotification('warning', `Document version restored by ${restoredBy}`);
    });

    socket.on('comment-added', (comment) => {
      fetchComments();
      if (comment.userId !== user.id) {
        addNotification('info', `New comment from ${comment.Author?.name}`);
      }
    });

    socket.on('comment-resolved', () => fetchComments());
    socket.on('comment-deleted', () => fetchComments());
    socket.on('comment-edited', () => fetchComments());

    return () => {
      socket.off('receive-changes', changesHandler);
      socket.off('load-document');
      socket.off('active-users');
      socket.off('receive-cursor');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('version-created');
      socket.off('document-restored');
      socket.off('comment-added');
      socket.off('comment-resolved');
      socket.off('comment-deleted');
      socket.off('comment-edited');
    };
  }, [socket, quill, previewVersion, user.id, activeUsers, documentId, addNotification]);

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

  // Search & Replace logic
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (!quill || !query.trim()) {
      setSearchResultsCount(0);
      setCurrentMatchIndex(0);
      return;
    }

    const text = quill.getText();
    const matches = [];
    let pos = text.toLowerCase().indexOf(query.toLowerCase());
    while (pos !== -1) {
      matches.push(pos);
      pos = text.toLowerCase().indexOf(query.toLowerCase(), pos + query.length);
    }

    setSearchResultsCount(matches.length);
    if (matches.length > 0) {
      setCurrentMatchIndex(1);
      quill.setSelection(matches[0], query.length);
    }
  };

  const handleNextMatch = () => {
    if (!quill || !searchQuery.trim() || searchResultsCount === 0) return;
    const text = quill.getText();
    const matches = [];
    let pos = text.toLowerCase().indexOf(searchQuery.toLowerCase());
    while (pos !== -1) {
      matches.push(pos);
      pos = text.toLowerCase().indexOf(searchQuery.toLowerCase(), pos + searchQuery.length);
    }

    const nextIdx = (currentMatchIndex % matches.length) + 1;
    setCurrentMatchIndex(nextIdx);
    quill.setSelection(matches[nextIdx - 1], searchQuery.length);
  };

  const handleReplace = () => {
    if (!quill || !searchQuery.trim() || (userRole !== 'OWNER' && userRole !== 'EDITOR')) return;
    const range = quill.getSelection();
    if (range) {
      quill.deleteText(range.index, range.length);
      quill.insertText(range.index, replaceQuery);
      handleSearch({ target: { value: searchQuery } });
      addNotification('success', 'Match replaced!');
    }
  };

  const handleReplaceAll = () => {
    if (!quill || !searchQuery.trim() || (userRole !== 'OWNER' && userRole !== 'EDITOR')) return;
    const text = quill.getText();
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newText = text.replace(regex, replaceQuery);
    quill.setText(newText);
    if (socket) socket.emit('save-document', quill.root.innerHTML);
    setSearchResultsCount(0);
    setCurrentMatchIndex(0);
    addNotification('success', 'Replaced all occurrences!');
  };

  // Export logic
  const handleExport = () => {
    if (!quill) return;
    
    if (exportType === 'md') {
      const html = quill.root.innerHTML;
      const md = htmlToMarkdown(html);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'document'}.md`;
      link.click();
      URL.revokeObjectURL(url);
      addNotification('success', 'Document exported to Markdown!');
    } else if (exportType === 'pdf') {
      const element = quill.root;
      const opt = {
        margin:       0.5,
        filename:     `${title || 'document'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save().then(() => {
        addNotification('success', 'Document exported to PDF!');
      });
    } else if (exportType === 'docx') {
      const html = quill.root.innerHTML;
      const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
      const postHtml = "</body></html>";
      const docHtml = preHtml + html + postHtml;
      const blob = new Blob(['\\ufeff', docHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title || 'document'}.doc`;
      link.click();
      URL.revokeObjectURL(url);
      addNotification('success', 'Document exported to DOCX!');
    } else if (exportType === 'pptx') {
      const pres = new pptxgen();
      const slide = pres.addSlide();
      const text = quill.getText();
      slide.addText(text, { x: 0.5, y: 0.5, w: "90%", h: "90%", align: "left" });
      pres.writeFile({ fileName: `${title || 'document'}.pptx` }).then(() => {
        addNotification('success', 'Document exported to PPTX!');
      });
    }
    setShowExportModal(false);
  };

  const updateContent = (htmlContent, fileName) => {
    if (quill) {
      quill.root.innerHTML = htmlContent;
      if (socket && (userRole === 'OWNER' || userRole === 'EDITOR')) {
        socket.emit('save-document', htmlContent);
      }
      addNotification('success', `Imported "${fileName}" successfully!`);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const mdContent = event.target.result;
        const htmlContent = markdownToHtml(mdContent);
        updateContent(htmlContent, file.name);
      };
      reader.readAsText(file);
    } else if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          updateContent(result.value, file.name);
        } catch (err) {
          console.error('Error importing DOCX:', err);
          addNotification('warning', 'Failed to parse DOCX file');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = event.target.result;
        const htmlContent = `<p>${textContent.replace(/\\n/g, '<br/>')}</p>`;
        updateContent(htmlContent, file.name);
      };
      reader.readAsText(file);
    } else {
      addNotification('warning', 'Unsupported file type for import.');
    }
  };

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
      addNotification('success', `Shared with ${shareEmail} as ${shareRole}!`);
      setShareEmail('');
      fetchCollaborators();
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'Failed to share';
      alert(errorMsg);
    }
  };

  // Remove collaborator
  const handleRemoveCollaborator = async (collabUserId) => {
    if (!window.confirm('Are you sure you want to remove this collaborator?')) return;
    try {
      await api.delete(`/documents/${documentId}/collaborators/${collabUserId}`);
      fetchCollaborators();
      addNotification('info', 'Collaborator removed');
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

  const handleEditCommentSubmit = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await api.put(`/documents/${documentId}/comments/${commentId}`, { content: editCommentText.trim() });
      setEditCommentId(null);
      setEditCommentText('');
      fetchComments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to edit comment');
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
      addNotification('success', 'Version snapshot created!');
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
    <div className={`h-screen flex flex-col overflow-hidden font-sans ${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Toast Notifications Stack */}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col space-y-2 max-w-sm pointer-events-none">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`p-3.5 rounded-xl shadow-xl border text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 pointer-events-auto ${
              n.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
              n.type === 'warning' ? 'bg-amber-600 text-white border-amber-500' :
              n.type === 'info' ? 'bg-blue-600 text-white border-blue-500' :
              'bg-gray-800 text-white border-gray-700'
            }`}
          >
            <Bell size={16} className="flex-shrink-0" />
            <span>{n.message}</span>
          </div>
        ))}
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between z-50">
          <div className="flex items-center space-x-2">
            <WifiOff size={16} className="animate-pulse" />
            <span>You are currently <strong>Offline</strong>. Edits are being cached locally in your browser.</span>
          </div>
          <span className="bg-amber-700 px-2 py-0.5 rounded text-[11px]">Offline Mode</span>
        </div>
      )}

      {/* Search & Replace Floating Bar */}
      {showSearch && (
        <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 z-40 animate-in slide-in-from-top-2 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <Search size={16} className="text-blue-500 flex-shrink-0" />
            <input
              type="text"
              placeholder="Find in document..."
              value={searchQuery}
              onChange={handleSearch}
              className={`w-full p-1.5 text-xs rounded-lg border outline-none ${
                isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
              }`}
            />
            {searchResultsCount > 0 && (
              <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
                {currentMatchIndex} of {searchResultsCount}
              </span>
            )}
            <button
              onClick={handleNextMatch}
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
              title="Next Match"
            >
              Next
            </button>
          </div>

          {(userRole === 'OWNER' || userRole === 'EDITOR') && (
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <input
                type="text"
                placeholder="Replace with..."
                value={replaceQuery}
                onChange={e => setReplaceQuery(e.target.value)}
                className={`w-full p-1.5 text-xs rounded-lg border outline-none ${
                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              />
              <button
                onClick={handleReplace}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium"
              >
                Replace
              </button>
              <button
                onClick={handleReplaceAll}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
              >
                Replace All
              </button>
            </div>
          )}

          <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className={`shadow-sm border-b px-4 py-2 flex items-center justify-between z-50 relative ${
        isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate('/')} 
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <input 
                type="text" 
                disabled={userRole !== 'OWNER' && userRole !== 'EDITOR'}
                className={`text-lg font-semibold border-b border-transparent focus:border-blue-500 bg-transparent focus:outline-none px-1.5 py-0.5 rounded transition-all ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                } ${(userRole === 'OWNER' || userRole === 'EDITOR') ? 'hover:bg-gray-50/10' : 'cursor-not-allowed'}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
              />
              {getRoleBadge(userRole)}
            </div>
            
            <div className="flex items-center text-xs px-1.5 mt-0.5 space-x-2 text-gray-400">
              {(userRole === 'OWNER' || userRole === 'EDITOR') && editorMode === 'EDITING' ? (
                saving ? (
                  <span className="flex items-center text-amber-500 font-medium">
                    <Save size={12} className="mr-1 animate-pulse" /> Saving changes...
                  </span>
                ) : (
                  <span className="flex items-center text-emerald-500 font-medium">
                    <Check size={12} className="mr-1" /> Saved to cloud
                  </span>
                )
              ) : (
                <span className="flex items-center text-gray-400 font-medium">
                  {editorMode === 'SUGGESTING' ? 'Suggesting Mode' : 'Read-Only Mode'}
                </span>
              )}

              <span>•</span>
              <span className={`flex items-center font-medium ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}>
                {isOnline ? <Wifi size={12} className="mr-1" /> : <WifiOff size={12} className="mr-1" />}
                {isOnline ? 'Online' : 'Offline'}
              </span>

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <>
                  <span>•</span>
                  <span className="text-blue-500 font-semibold animate-pulse">
                    {Array.from(typingUsers).join(', ')} is typing...
                  </span>
                </>
              )}

              <span>•</span>
              <span>By {documentInfo.Owner?.name}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Backdrop overlay */}
          {(showSettingsDropdown || showShare) && (
            <div 
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => {
                setShowSettingsDropdown(false);
                setShowShare(false);
              }}
            />
          )}

          {/* Active Collaborators Avatars */}
          <div 
            onClick={() => { 
              setShowPresenceDrawer(!showPresenceDrawer); 
              setShowVersionDrawer(false); 
              setShowCommentDrawer(false);
              setShowSettingsDropdown(false);
              setShowShare(false);
            }}
            className={`flex items-center space-x-2 border px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
              isDarkMode ? 'bg-gray-700 border-gray-600 hover:bg-gray-600' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
            }`}
            title="Active Collaborators Presence"
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
            <div className="flex items-center text-xs font-medium">
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
              setShowSettingsDropdown(false);
              setShowShare(false);
            }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showCommentDrawer 
                ? 'bg-blue-100 text-blue-700 border-blue-300' 
                : isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MessageSquare size={16} className="mr-1.5 text-blue-500" />
            <span className="hidden sm:inline">Comments</span>
          </button>

          {/* Version History Toggle Button */}
          <button
            onClick={() => { 
              setShowVersionDrawer(!showVersionDrawer); 
              setShowPresenceDrawer(false); 
              setShowCommentDrawer(false);
              setShowSettingsDropdown(false);
              setShowShare(false);
            }}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showVersionDrawer 
                ? 'bg-purple-100 text-purple-700 border-purple-300' 
                : isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <History size={16} className="mr-1.5 text-purple-500" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Settings Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSettingsDropdown(!showSettingsDropdown);
                setShowShare(false);
              }}
              className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center text-sm font-medium ${
                showSettingsDropdown 
                ? (isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'bg-gray-100 border-gray-300 text-gray-900')
                : (isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')
              }`}
              title="Settings & Tools"
            >
              <Settings size={16} className="mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline mr-1">Settings</span>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {showSettingsDropdown && (
              <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border p-2 z-[100] animate-in fade-in slide-in-from-top-2 ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-900'
              }`}>
                
                {/* Network Status */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-gray-500/20 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Network</span>
                  <span className={`flex items-center text-[11px] font-bold ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isOnline ? <Wifi size={12} className="mr-1" /> : <WifiOff size={12} className="mr-1" />}
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Editing Mode
                </div>

                {/* Editing Option */}
                <button
                  onClick={() => {
                    if (userRole === 'OWNER' || userRole === 'EDITOR') {
                      setEditorMode('EDITING');
                    }
                  }}
                  disabled={userRole !== 'OWNER' && userRole !== 'EDITOR'}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors ${
                    editorMode === 'EDITING' ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-gray-500/10 border border-transparent'
                  } ${(userRole !== 'OWNER' && userRole !== 'EDITOR') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Edit3 size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs flex justify-between items-center">
                      <span>Editing</span>
                      {editorMode === 'EDITING' && <Check size={14} className="text-blue-500 font-bold" />}
                    </div>
                  </div>
                </button>

                {/* Suggesting Option */}
                <button
                  onClick={() => {
                    if (userRole !== 'VIEWER') {
                      setEditorMode('SUGGESTING');
                    }
                  }}
                  disabled={userRole === 'VIEWER'}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors mt-1 ${
                    editorMode === 'SUGGESTING' ? 'bg-amber-500/10 border border-amber-500/30' : 'hover:bg-gray-500/10 border border-transparent'
                  } ${userRole === 'VIEWER' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <MessageSquare size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs flex justify-between items-center">
                      <span>Suggesting</span>
                      {editorMode === 'SUGGESTING' && <Check size={14} className="text-amber-500 font-bold" />}
                    </div>
                  </div>
                </button>

                {/* Viewing Option */}
                <button
                  onClick={() => {
                    setEditorMode('VIEWING');
                  }}
                  className={`w-full text-left p-2.5 rounded-xl flex items-start space-x-3 transition-colors mt-1 ${
                    editorMode === 'VIEWING' ? 'bg-gray-500/20 border border-gray-500/30' : 'hover:bg-gray-500/10 border border-transparent'
                  } cursor-pointer`}
                >
                  <Eye size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-xs flex justify-between items-center">
                      <span>Viewing</span>
                      {editorMode === 'VIEWING' && <Check size={14} className="font-bold" />}
                    </div>
                  </div>
                </button>

                <div className="my-2 border-t border-gray-500/20"></div>

                {/* Other Actions */}
                <div className="space-y-1">
                  <button
                    onClick={() => { setShowSearch(!showSearch); setShowSettingsDropdown(false); }}
                    className="w-full text-left p-2 flex items-center rounded-lg hover:bg-gray-500/10 text-xs font-medium"
                  >
                    <Search size={14} className="mr-2 text-blue-500" /> Search & Replace
                  </button>

                  <button
                    onClick={() => { setIsDarkMode(!isDarkMode); }}
                    className="w-full text-left p-2 flex items-center justify-between rounded-lg hover:bg-gray-500/10 text-xs font-medium"
                  >
                    <div className="flex items-center">
                      {isDarkMode ? <Sun size={14} className="mr-2 text-yellow-400" /> : <Moon size={14} className="mr-2 text-gray-500" />}
                      Dark Mode
                    </div>
                    {/* Tiny toggle visual */}
                    <div className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-colors ${isDarkMode ? 'bg-emerald-500 justify-end' : 'bg-gray-400 justify-start'}`}>
                      <div className="w-3 h-3 bg-white rounded-full shadow-sm"></div>
                    </div>
                  </button>

                  <button
                    onClick={() => { setShowExportModal(true); setShowSettingsDropdown(false); }}
                    className="w-full text-left p-2 flex items-center rounded-lg hover:bg-gray-500/10 text-xs font-medium"
                  >
                    <Download size={14} className="mr-2 text-emerald-500" /> Export Document
                  </button>

                  <label className="w-full cursor-pointer p-2 flex items-center rounded-lg hover:bg-gray-500/10 text-xs font-medium">
                    <Upload size={14} className="mr-2 text-blue-500" /> Import File (.md, .docx, .txt)
                    <input type="file" accept=".md,.docx,.txt" onChange={(e) => { handleImportFile(e); setShowSettingsDropdown(false); }} className="hidden" />
                  </label>

                  <button
                    onClick={() => { setShowShortcutsModal(true); setShowSettingsDropdown(false); }}
                    className="w-full text-left p-2 flex items-center rounded-lg hover:bg-gray-500/10 text-xs font-medium"
                  >
                    <Keyboard size={14} className="mr-2 text-purple-500" /> Keyboard Shortcuts
                  </button>
                </div>
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
              <div className={`absolute right-0 mt-2 w-96 rounded-2xl shadow-2xl border p-5 z-50 animate-in fade-in slide-in-from-top-2 ${
                isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-900'
              }`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-base flex items-center">
                    <Share2 size={18} className="mr-2 text-blue-500" /> Document Sharing & Permissions
                  </h3>
                  <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                  </button>
                </div>

                {/* Invite / Add Collaborator */}
                {(userRole === 'OWNER' || userRole === 'EDITOR') ? (
                  <form onSubmit={handleShare} className="mb-5 space-y-3 pb-4 border-b border-gray-700/50">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Invite Collaborator
                    </label>
                    <div className="flex space-x-2">
                      <input 
                        type="email" 
                        required 
                        placeholder="User's email address..." 
                        className={`flex-1 p-2 border rounded-lg text-xs outline-none ${
                          isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                        }`}
                        value={shareEmail}
                        onChange={e => setShareEmail(e.target.value)}
                      />
                      <select
                        value={shareRole}
                        onChange={e => setShareRole(e.target.value)}
                        className={`p-2 border rounded-lg text-xs font-medium outline-none ${
                          isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                        }`}
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
                  <div className="bg-gray-500/10 p-3 rounded-lg text-xs text-gray-400 mb-4">
                    Only Owner and Editors can invite or update sharing permissions.
                  </div>
                )}

                {/* Collaborators List */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    People with Access
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2.5">
                    {/* Owner Card */}
                    <div className="flex items-center justify-between p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center">
                          {documentInfo.Owner?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold">{documentInfo.Owner?.name}</div>
                          <div className="text-[11px] text-gray-400">{documentInfo.Owner?.email}</div>
                        </div>
                      </div>
                      <span className="font-semibold text-blue-500 bg-blue-500/20 px-2 py-0.5 rounded-full text-[10px]">Owner</span>
                    </div>

                    {/* Shared Collaborators */}
                    {loadingCollabs ? (
                      <div className="text-center py-4 text-xs text-gray-400">Loading collaborators...</div>
                    ) : collaborators.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-400">Not shared with anyone else yet.</div>
                    ) : (
                      collaborators.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2.5 bg-gray-500/10 rounded-xl border border-gray-500/20 text-xs">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-gray-600 text-white font-bold flex items-center justify-center">
                              {c.User?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">{c.User?.name}</div>
                              <div className="text-[11px] text-gray-400">{c.User?.email}</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {getRoleBadge(c.role)}
                            {userRole === 'OWNER' && (
                              <button 
                                onClick={() => handleRemoveCollaborator(c.userId)}
                                className="text-red-400 hover:text-red-600 p-1 hover:bg-red-500/10 rounded" 
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
        <main className={`flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center print:p-0 ${
          isDarkMode ? 'bg-gray-950' : 'bg-gray-100'
        }`}>
          {/* Permission Mode Banner */}
          {editorMode === 'SUGGESTING' && (
            <div className="w-full max-w-4xl bg-amber-500 text-white px-5 py-2.5 rounded-xl mb-4 shadow-md flex items-center space-x-2 text-xs font-medium print:hidden">
              <MessageCircle size={16} />
              <span><strong>Suggesting Mode:</strong> You can view the document and post comments/replies. Direct text editing is disabled.</span>
            </div>
          )}

          {editorMode === 'VIEWING' && (
            <div className="w-full max-w-4xl bg-gray-600 text-white px-5 py-2.5 rounded-xl mb-4 shadow-md flex items-center space-x-2 text-xs font-medium print:hidden">
              <Eye size={16} />
              <span><strong>Viewing Mode:</strong> Read-only access. Document editing is disabled.</span>
            </div>
          )}

          {/* Banner when viewing Revision Preview */}
          {previewVersion && (
            <div className="w-full max-w-4xl bg-purple-900 text-white px-5 py-3 rounded-xl mb-4 shadow-lg flex justify-between items-center print:hidden">
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
          <div className={`w-full max-w-4xl shadow-xl rounded-xl overflow-hidden border min-h-[850px] flex flex-col print:shadow-none print:border-none ${
            isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="flex-1" ref={wrapperRef}></div>
          </div>
        </main>

        {/* Keyboard Shortcuts Modal */}
        {showShortcutsModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
            <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 animate-in zoom-in-95 ${
              isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-900'
            }`}>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/40">
                <h3 className="font-bold text-base flex items-center">
                  <Keyboard size={18} className="mr-2 text-blue-500" /> Keyboard Shortcuts
                </h3>
                <button onClick={() => setShowShortcutsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Save Document</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + S</kbd>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Find in Document</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + F</kbd>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Save Version Snapshot</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + Shift + S</kbd>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Toggle Dark Mode</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + Shift + D</kbd>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Toggle Comments Drawer</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + Shift + C</kbd>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-gray-500/10">
                  <span>Toggle History Drawer</span>
                  <kbd className="px-2 py-0.5 bg-gray-700 text-gray-200 rounded font-mono text-[11px]">Ctrl + Shift + H</kbd>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Options Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-6 animate-in zoom-in-95 ${
              isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-100 text-gray-900'
            }`}>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/40">
                <h3 className="font-bold text-base flex items-center">
                  <Download size={18} className="mr-2 text-emerald-500" /> Export Document
                </h3>
                <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 mb-4">
                <label className="block text-xs font-semibold text-gray-500 mb-2">Select Format:</label>
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <button 
                    onClick={() => setExportType('pdf')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-colors ${exportType === 'pdf' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold' : (isDarkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}`}
                  >
                    <FileText size={24} />
                    <span>PDF</span>
                  </button>
                  <button 
                    onClick={() => setExportType('docx')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-colors ${exportType === 'docx' ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-bold' : (isDarkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}`}
                  >
                    <FileText size={24} />
                    <span>Word (.docx)</span>
                  </button>
                  <button 
                    onClick={() => setExportType('pptx')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-colors ${exportType === 'pptx' ? 'border-amber-500 bg-amber-500/10 text-amber-600 font-bold' : (isDarkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}`}
                  >
                    <ImageIcon size={24} />
                    <span>PowerPoint</span>
                  </button>
                  <button 
                    onClick={() => setExportType('md')}
                    className={`p-3 rounded-lg border-2 flex flex-col items-center justify-center space-y-2 transition-colors ${exportType === 'md' ? 'border-purple-500 bg-purple-500/10 text-purple-600 font-bold' : (isDarkMode ? 'border-gray-600 bg-gray-700 hover:bg-gray-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100')}`}
                  >
                    <FileText size={24} />
                    <span>Markdown</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <button onClick={() => setShowExportModal(false)} className={`px-4 py-2 text-xs font-semibold rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Cancel
                </button>
                <button onClick={handleExport} className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center">
                  <Download size={14} className="mr-1.5" /> Export Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Presence Awareness Side Drawer */}
        {showPresenceDrawer && (
          <aside className={`w-80 border-l shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200 ${
            isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="p-4 border-b border-gray-700/40 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Users size={18} className="text-blue-500" />
                <h3 className="font-semibold text-base">Active Collaborators</h3>
              </div>
              <button onClick={() => setShowPresenceDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
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
                  className="p-3 bg-gray-500/10 rounded-xl border border-gray-500/20 transition-colors"
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
                        <div className="font-semibold text-sm flex items-center">
                          {u.name} {u.id === user.id && <span className="text-xs text-blue-500 ml-1 font-normal">(You)</span>}
                        </div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                    
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-ping"></span>
                      Online
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-700/40 text-xs flex justify-between items-center">
                    <span className="text-gray-400 flex items-center">
                      <MapPin size={12} className="mr-1 text-gray-400" />
                      {u.activeLocation || 'Viewing document'}
                    </span>

                    {u.id !== user.id && u.cursor && (
                      <button
                        onClick={() => handleJumpToUserCursor(u)}
                        className="text-blue-500 hover:underline font-medium text-xs flex items-center"
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
          <aside className={`w-96 border-l shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200 ${
            isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="p-4 border-b border-gray-700/40 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <MessageSquare size={18} className="text-blue-500" />
                <h3 className="font-semibold text-base">Comments & Discussion</h3>
              </div>
              <button onClick={() => setShowCommentDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Post New Comment Input */}
            <div className="p-4 border-b border-gray-700/40 bg-blue-500/10">
              {userRole !== 'VIEWER' ? (
                <form onSubmit={handleAddComment} className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Add a Comment
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Write your comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className={`flex-1 p-2 text-xs border rounded-lg outline-none ${
                        isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
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
                <div className="text-xs text-gray-400 flex items-center space-x-1.5 p-1">
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
                      cmt.resolved 
                        ? 'bg-gray-500/10 border-gray-500/20 opacity-75' 
                        : isDarkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                          {cmt.Author?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-xs">{cmt.Author?.name}</div>
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
                              cmt.resolved ? 'text-emerald-500 bg-emerald-500/20' : 'text-gray-400 hover:text-emerald-500'
                            }`}
                            title={cmt.resolved ? 'Mark unresolved' : 'Mark resolved'}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}

                        {cmt.userId === user.id && (
                          <button
                            onClick={() => { setEditCommentId(cmt.id); setEditCommentText(cmt.content); }}
                            className="p-1 text-gray-400 hover:text-blue-500 rounded"
                            title="Edit comment"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}

                        {(cmt.userId === user.id || userRole === 'OWNER') && (
                          <button
                            onClick={() => handleDeleteComment(cmt.id)}
                            className="p-1 text-gray-400 hover:text-red-500 rounded"
                            title="Delete comment"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {editCommentId === cmt.id ? (
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          className={`flex-1 p-1 text-xs border rounded outline-none ${isDarkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
                        />
                        <button onClick={() => handleEditCommentSubmit(cmt.id)} className="text-blue-500 font-medium text-xs">Save</button>
                        <button onClick={() => setEditCommentId(null)} className="text-gray-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <p className={`text-xs mb-2 leading-relaxed ${cmt.resolved ? 'line-through text-gray-400' : ''}`}>
                        {cmt.content}
                      </p>
                    )}

                    {/* Nested Replies */}
                    {cmt.Replies && cmt.Replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-blue-500/40 space-y-2.5">
                        {cmt.Replies.map((r) => (
                          <div key={r.id} className="p-2.5 rounded-xl border border-gray-500/20 text-xs bg-gray-500/10">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold">{r.Author?.name}</span>
                              <div className="flex items-center space-x-1">
                                <span className="text-[10px] text-gray-400">
                                  {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                                </span>
                                {r.userId === user.id && (
                                  <button onClick={() => { setEditCommentId(r.id); setEditCommentText(r.content); }} className="text-gray-400 hover:text-blue-500 p-0.5" title="Edit reply">
                                    <Edit3 size={12} />
                                  </button>
                                )}
                                {(r.userId === user.id || userRole === 'OWNER') && (
                                  <button
                                    onClick={() => handleDeleteComment(r.id)}
                                    className="text-gray-400 hover:text-red-500 p-0.5"
                                    title="Delete reply"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            {editCommentId === r.id ? (
                              <div className="flex space-x-2 mt-1">
                                <input
                                  type="text"
                                  value={editCommentText}
                                  onChange={(e) => setEditCommentText(e.target.value)}
                                  className={`flex-1 p-1 text-[11px] border rounded outline-none ${isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'bg-white border-gray-300'}`}
                                />
                                <button onClick={() => handleEditCommentSubmit(r.id)} className="text-blue-500 text-[10px]">Save</button>
                                <button onClick={() => setEditCommentId(null)} className="text-gray-400 text-[10px]">Cancel</button>
                              </div>
                            ) : (
                              <p className="text-gray-300">{r.content}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Action */}
                    {userRole !== 'VIEWER' && (
                      <div className="mt-2.5 pt-2 border-t border-gray-700/40">
                        {activeReplyId === cmt.id ? (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Write a reply..."
                              value={replyTextMap[cmt.id] || ''}
                              onChange={(e) => setReplyTextMap(prev => ({ ...prev, [cmt.id]: e.target.value }))}
                              className={`flex-1 p-1.5 text-xs border rounded-lg outline-none ${
                                isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                              }`}
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
                            className="text-xs text-blue-500 hover:underline font-medium flex items-center"
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
          <aside className={`w-96 border-l shadow-xl flex flex-col z-30 animate-in slide-in-from-right duration-200 ${
            isDarkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <div className="p-4 border-b border-gray-700/40 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <History size={18} className="text-purple-500" />
                <h3 className="font-semibold text-base">Version History</h3>
              </div>
              <button onClick={() => setShowVersionDrawer(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Create Snapshot Form */}
            {(userRole === 'OWNER' || userRole === 'EDITOR') && (
              <div className="p-4 border-b border-gray-700/40 bg-purple-500/10">
                <form onSubmit={handleCreateSnapshot} className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-purple-400">
                    Save Version Snapshot
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Version name (e.g. Draft 1)"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      className={`flex-1 p-2 text-xs border rounded-lg outline-none ${
                        isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                      }`}
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
              <div className="flex flex-col mb-4 space-y-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Revisions ({versions.length})
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search versions..."
                    value={versionSearchQuery}
                    onChange={(e) => setVersionSearchQuery(e.target.value)}
                    className={`w-full pl-7 p-1.5 text-xs border rounded-lg outline-none ${
                      isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                    }`}
                  />
                </div>
              </div>

              {loadingVersions ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading revisions...</div>
              ) : versions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No revisions created yet.</div>
              ) : (
                versions
                  .filter(v => (v.versionName || 'Snapshot').toLowerCase().includes(versionSearchQuery.toLowerCase()))
                  .map((ver) => (
                  <div
                    key={ver.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      previewVersion?.id === ver.id
                        ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/30'
                        : isDarkMode ? 'bg-gray-700/40 border-gray-600 hover:border-purple-500' : 'bg-white border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-sm line-clamp-1">
                        {ver.versionName || 'Snapshot'}
                      </h4>
                      <span className="text-[11px] text-gray-400 flex items-center whitespace-nowrap">
                        <Clock size={11} className="mr-1" />
                        {formatDistanceToNow(new Date(ver.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    <div className="text-xs text-gray-400 mb-3 flex items-center">
                      <span className="w-5 h-5 rounded-full bg-gray-600 text-white font-bold flex items-center justify-center text-[10px] mr-1.5">
                        {ver.Creator?.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                      <span>By <strong>{ver.Creator?.name || 'Unknown'}</strong></span>
                    </div>

                    <div className="text-[11px] text-gray-400 mb-3">
                      {format(new Date(ver.createdAt), 'MMM d, yyyy • h:mm:ss a')}
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-gray-700/30">
                      <button
                        onClick={() => handlePreviewVersion(ver)}
                        className="flex-1 py-1.5 px-2 bg-gray-500/20 hover:bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium flex items-center justify-center transition-colors"
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
          background: ${isDarkMode ? '#1e293b' : '#f8fafc'};
          border-bottom: 1px solid ${isDarkMode ? '#334155' : '#e2e8f0'} !important;
          padding: 12px 20px !important;
        }
        .ql-toolbar .ql-stroke {
          stroke: ${isDarkMode ? '#cbd5e1' : '#475569'} !important;
        }
        .ql-toolbar .ql-fill {
          fill: ${isDarkMode ? '#cbd5e1' : '#475569'} !important;
        }
        .ql-toolbar .ql-picker {
          color: ${isDarkMode ? '#cbd5e1' : '#475569'} !important;
        }
        .ql-container.ql-snow {
          border: none !important;
        }
        .ql-editor {
          padding: 40px 60px !important;
          min-height: 800px;
          color: ${isDarkMode ? '#f8fafc' : '#0f172a'};
        }
        .ql-cursor-flag {
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 600;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, aside, .print\\:hidden {
            display: none !important;
          }
          .ql-toolbar {
            display: none !important;
          }
          .ql-editor {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentEditor;
