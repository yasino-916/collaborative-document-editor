import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { ArrowLeft, Users, Share2, Save, Check } from 'lucide-react';
import QuillCursors from 'quill-cursors';

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
  const [activeUsers, setActiveUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [showShare, setShowShare] = useState(false);
  const navigate = useNavigate();

  const cursorsRef = useRef(null);

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
    } catch (err) {
      navigate('/');
    }
  };

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

  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== 'user') return;
      socket.emit('send-changes', delta);
      
      // Auto save locally (debounced in real app)
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
  }, [socket, quill]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const handler = (delta) => {
      quill.updateContents(delta);
    };
    socket.on('receive-changes', handler);

    socket.on('load-document', (document) => {
      quill.root.innerHTML = document || '';
      quill.enable();
    });

    socket.on('active-users', (users) => {
      setActiveUsers(users);
    });

    socket.on('receive-cursor', (data) => {
      if (!cursorsRef.current) return;
      cursorsRef.current.createCursor(data.id, data.name, data.color);
      cursorsRef.current.moveCursor(data.id, data.range);
    });

    return () => {
      socket.off('receive-changes', handler);
      socket.off('load-document');
      socket.off('active-users');
      socket.off('receive-cursor');
    };
  }, [socket, quill]);

  useEffect(() => {
    if (socket == null || quill == null) return;

    const cursorHandler = (range, oldRange, source) => {
      if (source === 'user' && range) {
        socket.emit('cursor-move', range);
      }
    };
    quill.on('selection-change', cursorHandler);

    return () => quill.off('selection-change', cursorHandler);
  }, [socket, quill]);

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/documents/${documentId}/share`, { email: shareEmail, role: 'EDITOR' });
      alert('Shared successfully!');
      setShareEmail('');
      setShowShare(false);
    } catch (err) {
      let errorMsg = err.response?.data?.error || 'Failed to share';
      if (errorMsg === 'User not found') {
        errorMsg = 'User not found! They must create an account on SyncWrite first before you can share with them.';
      }
      alert(errorMsg);
    }
  };

  if (!documentInfo) return <div className="p-10 text-center text-gray-500">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-700 bg-gray-100 p-2 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <input 
              type="text" 
              className="text-xl font-semibold text-gray-900 border-none bg-transparent focus:ring-0 p-0 hover:bg-gray-50 rounded"
              defaultValue={documentInfo.title}
              onBlur={async (e) => {
                const newTitle = e.target.value;
                if(newTitle !== documentInfo.title) {
                  // Save title via api in real app
                }
              }}
            />
            <div className="flex items-center text-xs text-gray-500 mt-0.5">
              {saving ? (
                <><Save size={12} className="mr-1 inline" /> Saving...</>
              ) : (
                <><Check size={12} className="mr-1 inline" /> Saved to cloud</>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center -space-x-2 mr-4">
            {activeUsers.map(u => (
              <div 
                key={u.id} 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-sm"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowShare(!showShare)}
              className="flex items-center bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Share2 size={16} className="mr-2" /> Share
            </button>
            
            {showShare && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50">
                <h3 className="font-semibold text-gray-800 mb-3">Share Document</h3>
                <form onSubmit={handleShare}>
                  <input 
                    type="email" 
                    required 
                    placeholder="User's email" 
                    className="w-full p-2 border border-gray-300 rounded-md mb-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                    value={shareEmail}
                    onChange={e => setShareEmail(e.target.value)}
                  />
                  <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                    Send Invite
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-gray-50 p-4 sm:p-8 flex justify-center">
        <div className="w-full max-w-4xl bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
          <div className="h-full min-h-[800px]" ref={wrapperRef}></div>
        </div>
      </main>
      
      <style>{`
        .ql-container {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
        }
        .ql-toolbar {
          border-top: none !important;
          border-left: none !important;
          border-right: none !important;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb !important;
          padding: 12px 20px !important;
        }
        .ql-container.ql-snow {
          border: none !important;
        }
        .ql-editor {
          padding: 40px 60px !important;
          min-height: 800px;
        }
      `}</style>
    </div>
  );
};

export default DocumentEditor;
