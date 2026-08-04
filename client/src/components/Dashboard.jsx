import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, Plus, LogOut, Trash2, Edit2, Copy, Menu, X,
  Users, Clock, Star, Settings, HelpCircle, FolderOpen, HardDrive,
  Sheet, Presentation, Video, ClipboardList, KeyRound, Eye, EyeOff, Check
} from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user, api, logout } = useAuth();
  const [ownedDocs, setOwnedDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('docs');
  const navigate = useNavigate();
  const profileMenuRef = useRef(null);

  // Settings state
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  // Profile dropdown state
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Change password modal state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.get('/documents');
      setOwnedDocs(res.data.ownedDocs);
      setSharedDocs(res.data.sharedDocs);
    } catch (err) {
      console.error(err);
    }
  }, [api]);

  useEffect(() => {
    fetchDocs();
    // Initialize settings values from user
    if (user) {
      setNameValue(user.name || '');
      setEmailValue(user.email || '');
    }
  }, [user, fetchDocs]);

  // Socket connection for real-time share notifications
  useEffect(() => {
    if (!user) return;

    const s = io('http://localhost:3001');
    socketRef.current = s;

    s.on('documentShared', (data) => {
      if (data.userId === user.id) {
        fetchDocs();
        const msg = `${data.sharedBy} shared "${data.document.title}" with you as ${data.role}`;
        setNotification(msg);
        setTimeout(() => setNotification(null), 5000);
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user, fetchDocs]);

  const createDoc = async () => {
    try {
      const res = await api.post('/documents', { title: 'Untitled Document' });
      navigate(`/document/${res.data.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const createItem = async (title, type = 'doc') => {
    try {
      // In a real app we'd have a type field in the DB.
      // Here we rely on title to render the correct view for the prototype.
      const res = await api.post('/documents', { title });
      if (type === 'sheet') {
        navigate(`/spreadsheet/${res.data.id}`);
      } else if (type === 'presentation') {
        navigate(`/presentation/${res.data.id}`);
      } else {
        navigate(`/document/${res.data.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteDoc = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  const renameDoc = async (doc) => {
    const newTitle = window.prompt('Enter new title:', doc.title);
    if (newTitle && newTitle.trim() !== doc.title) {
      try {
        await api.put(`/documents/${doc.id}`, { title: newTitle.trim() });
        fetchDocs();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const duplicateDoc = async (id) => {
    try {
      await api.post(`/documents/${id}/duplicate`);
      fetchDocs();
    } catch (err) {
      console.error(err);
    }
  };

  // Settings functions
  const updateName = async () => {
    if (!nameValue.trim()) {
      alert('Name cannot be empty');
      setNameValue(user.name);
      setEditingName(false);
      return;
    }
    try {
      await api.put('/auth/profile', { name: nameValue });
      setEditingName(false);
      alert('Name updated successfully');
      // Update user context would happen here if you have a context update function
    } catch (err) {
      console.error(err);
      alert('Failed to update name');
      setNameValue(user.name);
    }
  };

  const updateEmail = async () => {
    if (!emailValue.trim() || !emailValue.includes('@')) {
      alert('Please enter a valid email');
      setEmailValue(user.email);
      setEditingEmail(false);
      return;
    }
    try {
      await api.put('/auth/profile', { email: emailValue });
      setEditingEmail(false);
      alert('Email updated successfully. Please verify your new email.');
    } catch (err) {
      console.error(err);
      alert('Failed to update email');
      setEmailValue(user.email);
    }
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Password strength checker
  const getPasswordStrength = (pw) => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) score++;
    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score === 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const resetChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPwError('');
    setPwSuccess(false);
    setPwLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    // Validate new password strength
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPwError('New password must contain at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setPwError('New password must contain at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPwError('New password must contain at least one number.');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setPwError('New password must contain at least one special character (!@#$%^&*).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirm password do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPwError('New password must be different from current password.');
      return;
    }

    setPwLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowChangePassword(false);
        resetChangePassword();
      }, 2000);
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.\n\n' +
      'All your documents will be permanently deleted.'
    );
    if (!confirmed) return;

    const finalConfirm = window.prompt('Type "DELETE" to confirm account deletion:');
    if (finalConfirm !== 'DELETE') {
      alert('Account deletion cancelled');
      return;
    }

    api.delete('/auth/account')
      .then(() => {
        alert('Account deleted successfully');
        logout();
      })
      .catch(err => {
        console.error(err);
        alert('Failed to delete account');
      });
  };

  const handleManageStorage = () => {
    alert('Storage management feature coming soon!\n\nCurrent usage: 2.4 GB of 15 GB (16%)');
  };

  const renderDocCard = (doc, isOwner) => {
    const title = doc.title.toLowerCase();
    const isSheet = title.includes('spreadsheet') || 
                    title.includes('budget') || 
                    title.includes('to-do list') || 
                    title.includes('calendar') || 
                    title.includes('finance');
    
    const isPresentation = title.includes('presentation') || 
                           title.includes('pitch deck') || 
                           title.includes('business proposal') || 
                           title.includes('portfolio') || 
                           title.includes('education') || 
                           title.includes('marketing');
    
    const docLink = isSheet ? `/spreadsheet/${doc.id}` : isPresentation ? `/presentation/${doc.id}` : `/document/${doc.id}`;
    const Icon = isSheet ? Sheet : isPresentation ? Presentation : FileText;
    const iconColorClass = isSheet ? 'text-green-600 bg-green-50' : isPresentation ? 'text-yellow-600 bg-yellow-50' : 'text-blue-600 bg-indigo-50';

    return (
    <div key={doc.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-5">
      <Link to={docLink} className="block">
        <div className="flex items-center mb-4">
          <div className={`p-3 rounded-lg mr-4 ${iconColorClass}`}>
            <Icon size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 line-clamp-1">{doc.title}</h3>
              {isOwner && doc.hasCollaborators && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  <Users size={12} className="mr-1" />
                  Shared
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Created: {format(new Date(doc.createdAt || doc.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
            <p className="text-xs text-gray-500">
              Modified: {format(new Date(doc.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
            {isOwner && doc.collaboratorCount > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                {doc.collaboratorCount} {doc.collaboratorCount === 1 ? 'collaborator' : 'collaborators'}
              </p>
            )}
          </div>
        </div>
      </Link>
      <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-sm text-gray-500">
        <span>By {doc.Owner?.name || 'Unknown'}</span>
        <div className="flex space-x-1">
          {isOwner && (
            <button onClick={() => renameDoc(doc)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-md transition-colors" title="Rename">
              <Edit2 size={16} />
            </button>
          )}
          <button onClick={() => duplicateDoc(doc.id)} className="text-green-500 hover:bg-green-50 p-1.5 rounded-md transition-colors" title="Duplicate">
            <Copy size={16} />
          </button>
          {isOwner && (
            <button onClick={() => deleteDoc(doc.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors" title="Delete">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Share notification toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center space-x-3 animate-in fade-in slide-in-from-top-2">
          <Users size={16} className="flex-shrink-0" />
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="ml-2 text-white/80 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}
      {/* Sidebar - Google Docs Style */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-white border-r border-gray-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col`}>
        {/* Logo/Header */}
        <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-blue-500 text-2xl font-bold">S</span>
            <span className="text-red-500 text-2xl font-bold">y</span>
            <span className="text-yellow-500 text-2xl font-bold">n</span>
            <span className="text-blue-500 text-2xl font-bold">c</span>
            <span className="text-green-500 text-2xl font-bold">W</span>
            <span className="text-red-500 text-2xl font-bold">r</span>
            <span className="text-blue-500 text-2xl font-bold">i</span>
            <span className="text-yellow-500 text-2xl font-bold">t</span>
            <span className="text-green-500 text-2xl font-bold">e</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            title="Close sidebar"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3">
          <button
            onClick={() => setActiveView('docs')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'docs' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <FileText size={22} className="text-blue-500" />
            <span className="text-base font-normal">Docs</span>
          </button>

          <button
            onClick={() => setActiveView('sheets')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'sheets' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Sheet size={22} className="text-green-500" />
            <span className="text-base font-normal">Sheets</span>
          </button>

          <button
            onClick={() => setActiveView('slides')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'slides' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Presentation size={22} className="text-yellow-500" />
            <span className="text-base font-normal">Slides</span>
          </button>

          <button
            onClick={() => setActiveView('vids')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'vids' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Video size={22} className="text-purple-500" />
            <span className="text-base font-normal">Vids</span>
          </button>

          <button
            onClick={() => setActiveView('forms')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-6 ${activeView === 'forms' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <ClipboardList size={22} className="text-purple-600" />
            <span className="text-base font-normal">Forms</span>
          </button>

          {/* Settings Section */}
          <button
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <Settings size={22} className="text-gray-500" />
            <span className="text-base font-normal">Settings</span>
          </button>

          <button
            onClick={() => setActiveView('help')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${activeView === 'help' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <HelpCircle size={22} className="text-gray-500" />
            <span className="text-base font-normal">Help & Feedback</span>
          </button>

          <button
            onClick={() => setActiveView('drive')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors ${activeView === 'drive' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
              }`}
          >
            <HardDrive size={22} className="text-blue-500" />
            <span className="text-base font-normal">Drive</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Open sidebar"
                >
                  <Menu size={24} />
                </button>
              )}
              <h2 className="text-xl font-semibold text-gray-900">
                {activeView === 'docs' && 'My Documents'}
                {activeView === 'sheets' && 'Sheets'}
                {activeView === 'slides' && 'Slides'}
                {activeView === 'vids' && 'Videos'}
                {activeView === 'forms' && 'Forms'}
                {activeView === 'settings' && 'Settings'}
                {activeView === 'help' && 'Help & Feedback'}
                {activeView === 'drive' && 'Drive'}
              </h2>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchDocs}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                title="Refresh documents"
              >
                <Clock size={20} />
              </button>
              <button
                onClick={createDoc}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
              >
                <Plus size={20} className="mr-2" /> New Document
              </button>

              {/* Profile Button + Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(prev => !prev)}
                  className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center font-semibold text-sm transition-colors shadow-sm"
                  title="Profile"
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
                    {/* User info header */}
                    <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setActiveView('settings');
                        }}
                        className="w-full flex items-center px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings size={16} className="mr-3 text-gray-400" />
                        Edit Profile
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          resetChangePassword();
                          setShowChangePassword(true);
                        }}
                        className="w-full flex items-center px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <KeyRound size={16} className="mr-3 text-gray-400" />
                        Change Password
                      </button>

                      <div className="border-t border-gray-100 my-1" />

                      <button
                        onClick={() => { setShowProfileMenu(false); logout(); }}
                        className="w-full flex items-center px-5 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} className="mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Docs View */}
          {activeView === 'docs' && (
            <>
              {ownedDocs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {ownedDocs.map(doc => renderDocCard(doc, true))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                  <FolderOpen size={64} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No documents yet</h3>
                  <p className="text-gray-500 mb-6">Create your first document to get started.</p>
                  <button
                    onClick={createDoc}
                    className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-all"
                  >
                    <Plus size={20} className="mr-2" /> Create Document
                  </button>
                </div>
              )}

              {/* Shared with me section */}
              {sharedDocs.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-base font-semibold text-gray-700 mb-4 flex items-center">
                    <Users size={18} className="mr-2 text-blue-500" /> Shared with me
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {sharedDocs.map(doc => renderDocCard(doc, false))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Sheets View */}
          {activeView === 'sheets' && (
            <div>
              {/* Template Gallery */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Start a new spreadsheet</h3>
                  <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center">
                    Template gallery
                    <span className="ml-1">▼</span>
                  </button>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Blank Spreadsheet */}
                  <button onClick={() => createItem('Untitled Spreadsheet', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-yellow-400 to-green-400 opacity-20 rounded"></div>
                        <Plus size={48} className="text-green-600 relative z-10" />
                      </div>
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank spreadsheet</span>
                  </button>

                  {/* To-do list */}
                  <div onClick={() => createItem('To-do list', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-green-50 to-green-100 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2">
                        <div className="space-y-1">
                          <div className="h-2 bg-green-500 rounded w-3/4"></div>
                          <div className="h-1.5 bg-gray-200 rounded w-full"></div>
                          <div className="h-1.5 bg-gray-200 rounded w-5/6"></div>
                          <div className="h-1.5 bg-gray-200 rounded w-4/6"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">To-do list</span>
                    </div>
                  </div>

                  {/* Annual budget */}
                  <div onClick={() => createItem('Annual budget', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-orange-50 to-red-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2">
                        <div className="space-y-1">
                          <div className="h-1.5 bg-red-400 rounded w-2/3"></div>
                          <div className="h-1.5 bg-orange-300 rounded w-4/5"></div>
                          <div className="h-1.5 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-1.5 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Annual budget</span>
                    </div>
                  </div>

                  {/* Monthly budget */}
                  <div onClick={() => createItem('Monthly budget', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-indigo-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex items-center justify-center">
                        <div className="flex space-x-1 items-end">
                          <div className="w-3 h-8 bg-orange-400 rounded-t"></div>
                          <div className="w-3 h-12 bg-blue-500 rounded-t"></div>
                          <div className="w-3 h-6 bg-gray-300 rounded-t"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Monthly budget</span>
                    </div>
                  </div>

                  {/* Finance Investment */}
                  <div onClick={() => createItem('Finance Investment', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-blue-100 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2">
                        <div className="space-y-1.5">
                          <div className="flex space-x-1">
                            <div className="h-1.5 bg-blue-500 rounded flex-1"></div>
                            <div className="h-1.5 bg-blue-300 rounded flex-1"></div>
                          </div>
                          <div className="h-1 bg-gray-200 rounded"></div>
                          <div className="h-1 bg-gray-200 rounded"></div>
                          <div className="h-1 bg-gray-200 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Finance Investment</span>
                    </div>
                  </div>

                  {/* Annual Calendar */}
                  <div onClick={() => createItem('Annual Calendar', 'sheet')} className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-teal-50 to-cyan-100 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2">
                        <div className="grid grid-cols-7 gap-0.5">
                          {[...Array(21)].map((_, i) => (
                            <div key={i} className={`h-1 rounded-sm ${i % 7 === 0 || i % 7 === 6 ? 'bg-teal-200' : 'bg-gray-200'}`}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Annual Calendar</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Spreadsheets Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Recent spreadsheets</h3>
                  <div className="flex items-center space-x-2">
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Owned by anyone</option>
                      <option>Owned by me</option>
                      <option>Not owned by me</option>
                    </select>
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Last opened by me</option>
                      <option>Last modified by me</option>
                      <option>Last modified</option>
                    </select>
                    <button className="p-2 hover:bg-gray-100 rounded" title="Grid view">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="2" y="2" width="6" height="6" rx="1" />
                        <rect x="12" y="2" width="6" height="6" rx="1" />
                        <rect x="2" y="12" width="6" height="6" rx="1" />
                        <rect x="12" y="12" width="6" height="6" rx="1" />
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded" title="List view">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="2" y="3" width="16" height="2" rx="1" />
                        <rect x="2" y="9" width="16" height="2" rx="1" />
                        <rect x="2" y="15" width="16" height="2" rx="1" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Empty State */}
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <Sheet size={64} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="text-xl font-normal text-gray-700 mb-2">No spreadsheets yet</h4>
                  <p className="text-gray-500 text-sm mb-4">
                    Select a blank spreadsheet or choose another template above to get started
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Slides View */}
          {activeView === 'slides' && (
            <div>
              {/* Template Gallery */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Start a new presentation</h3>
                  <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center">
                    Template gallery
                    <span className="ml-1">▼</span>
                  </button>
                </div>

                {/* Template Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Blank Presentation */}
                  <button onClick={() => createItem('Untitled Presentation', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <Plus size={48} className="text-yellow-600" />
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank presentation</span>
                  </button>

                  {/* Pitch Deck */}
                  <div onClick={() => createItem('Pitch Deck', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-yellow-50 to-orange-100 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex flex-col justify-center items-center">
                        <div className="w-8 h-8 bg-yellow-400 rounded-full mb-1"></div>
                        <div className="h-1.5 bg-gray-300 rounded w-3/4"></div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Pitch Deck</span>
                    </div>
                  </div>

                  {/* Business Proposal */}
                  <div onClick={() => createItem('Business Proposal', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-purple-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2">
                        <div className="space-y-1">
                          <div className="h-2 bg-blue-500 rounded w-2/3 mx-auto"></div>
                          <div className="h-1 bg-gray-200 rounded w-4/5 mx-auto"></div>
                          <div className="h-1 bg-gray-200 rounded w-3/4 mx-auto"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Business Proposal</span>
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div onClick={() => createItem('Portfolio', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-pink-50 to-red-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-1 grid grid-cols-2 gap-1">
                        <div className="bg-pink-200 rounded"></div>
                        <div className="bg-red-200 rounded"></div>
                        <div className="bg-orange-200 rounded"></div>
                        <div className="bg-yellow-200 rounded"></div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Portfolio</span>
                    </div>
                  </div>

                  {/* Education */}
                  <div onClick={() => createItem('Education', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-green-50 to-teal-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex items-center justify-center">
                        <div className="text-4xl text-green-500">📚</div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Education</span>
                    </div>
                  </div>

                  {/* Marketing */}
                  <div onClick={() => createItem('Marketing', 'presentation')} className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
                    <div className="aspect-[3/4] bg-gradient-to-br from-purple-50 to-pink-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex items-center justify-center">
                        <div className="text-3xl">📊</div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Marketing</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Presentations */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Recent presentations</h3>
                  <div className="flex items-center space-x-2">
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Owned by anyone</option>
                      <option>Owned by me</option>
                    </select>
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Last opened by me</option>
                      <option>Last modified</option>
                    </select>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <Presentation size={64} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="text-xl font-normal text-gray-700 mb-2">No presentations yet</h4>
                  <p className="text-gray-500 text-sm">Select a blank presentation or choose a template above to get started</p>
                </div>
              </div>
            </div>
          )}

          {/* Vids View */}
          {activeView === 'vids' && (
            <div>
              {/* Action Buttons */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Start a new video</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* New Recording */}
                  <button onClick={() => createItem('New Recording')} className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <Video size={32} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">New Recording</span>
                    <span className="text-xs text-gray-500 mt-1">Record your screen</span>
                  </button>

                  {/* Upload Video */}
                  <button onClick={() => alert('Video upload functionality coming soon!')} className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <Plus size={32} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Upload Video</span>
                    <span className="text-xs text-gray-500 mt-1">From your device</span>
                  </button>

                  {/* From Drive */}
                  <button onClick={() => setActiveView('drive')} className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <HardDrive size={32} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">From Drive</span>
                    <span className="text-xs text-gray-500 mt-1">Import existing video</span>
                  </button>
                </div>
              </div>

              {/* Recent Videos */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Recent videos</h3>
                  <div className="flex items-center space-x-2">
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>All videos</option>
                      <option>My videos</option>
                      <option>Shared with me</option>
                    </select>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <Video size={64} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="text-xl font-normal text-gray-700 mb-2">No videos yet</h4>
                  <p className="text-gray-500 text-sm">Start recording or upload your first video</p>
                </div>
              </div>
            </div>
          )}

          {/* Forms View */}
          {activeView === 'forms' && (
            <div>
              {/* Template Gallery */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Start a new form</h3>
                  <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center">
                    Template gallery
                    <span className="ml-1">▼</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {/* Blank Form */}
                  <button onClick={() => createItem('Untitled Form')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <Plus size={48} className="text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank form</span>
                  </button>

                  {/* Contact Form */}
                  <div onClick={() => createItem('Contact Info')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
                    <div className="aspect-[3/4] bg-gradient-to-br from-purple-50 to-pink-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 space-y-1">
                        <div className="h-1.5 bg-purple-400 rounded w-2/3"></div>
                        <div className="h-1 bg-gray-200 rounded"></div>
                        <div className="h-1 bg-gray-200 rounded w-4/5"></div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Contact Info</span>
                    </div>
                  </div>

                  {/* Event Registration */}
                  <div onClick={() => createItem('Event Registration')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
                    <div className="aspect-[3/4] bg-gradient-to-br from-blue-50 to-indigo-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 space-y-1">
                        <div className="h-2 bg-blue-500 rounded w-3/4"></div>
                        <div className="h-1 bg-gray-200 rounded"></div>
                        <div className="h-1 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Event Registration</span>
                    </div>
                  </div>

                  {/* Survey */}
                  <div onClick={() => createItem('Survey')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
                    <div className="aspect-[3/4] bg-gradient-to-br from-green-50 to-teal-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 space-y-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <div className="h-1 bg-gray-200 rounded flex-1"></div>
                        </div>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <div className="h-1 bg-gray-200 rounded flex-1"></div>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Survey</span>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div onClick={() => createItem('Feedback')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
                    <div className="aspect-[3/4] bg-gradient-to-br from-orange-50 to-red-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex items-center justify-center">
                        <div className="text-3xl">⭐</div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Feedback</span>
                    </div>
                  </div>

                  {/* Quiz */}
                  <div onClick={() => createItem('Quiz')} className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
                    <div className="aspect-[3/4] bg-gradient-to-br from-yellow-50 to-orange-50 p-3 flex items-center justify-center">
                      <div className="bg-white w-full h-full rounded shadow-sm p-2 flex items-center justify-center">
                        <div className="text-3xl">📝</div>
                      </div>
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-sm text-gray-700">Quiz</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Forms */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">Recent forms</h3>
                  <div className="flex items-center space-x-2">
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Owned by anyone</option>
                      <option>Owned by me</option>
                    </select>
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Last opened by me</option>
                      <option>Last modified</option>
                    </select>
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <ClipboardList size={64} className="mx-auto text-gray-300 mb-4" />
                  <h4 className="text-xl font-normal text-gray-700 mb-2">No forms yet</h4>
                  <p className="text-gray-500 text-sm">Select a blank form or choose a template above to get started</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings View */}
          {activeView === 'settings' && (
            <div className="max-w-3xl">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Profile Section */}
                <div className="p-8 border-b border-gray-200">
                  <div className="mb-6">
                    <label className="block text-sm text-gray-600 mb-2">Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingName ? nameValue : user.name}
                        onChange={(e) => setNameValue(e.target.value)}
                        disabled={!editingName}
                        className={`flex-1 px-4 py-2.5 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${editingName ? 'bg-white' : 'bg-gray-50'
                          }`}
                      />
                      {editingName ? (
                        <>
                          <button
                            onClick={updateName}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingName(false);
                              setNameValue(user.name);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingName(true)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">Email</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={editingEmail ? emailValue : user.email}
                        onChange={(e) => setEmailValue(e.target.value)}
                        disabled={!editingEmail}
                        className={`flex-1 px-4 py-2.5 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${editingEmail ? 'bg-white' : 'bg-gray-50'
                          }`}
                      />
                      {editingEmail ? (
                        <>
                          <button
                            onClick={updateEmail}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingEmail(false);
                              setEmailValue(user.email);
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingEmail(true)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Preferences */}
                <div className="p-8 border-b border-gray-200">
                  <h3 className="text-base font-normal text-gray-900 mb-6">Preferences</h3>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-700">Email notifications</span>
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        checked={emailNotifications}
                        onChange={(e) => {
                          setEmailNotifications(e.target.checked);
                          // Save preference to localStorage or API
                          localStorage.setItem('emailNotifications', e.target.checked);
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-700">Desktop notifications</span>
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        checked={desktopNotifications}
                        onChange={(e) => {
                          setDesktopNotifications(e.target.checked);
                          localStorage.setItem('desktopNotifications', e.target.checked);
                          if (e.target.checked && 'Notification' in window) {
                            Notification.requestPermission();
                          }
                        }}
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-sm text-gray-700">Auto-save documents</span>
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        checked={autoSave}
                        onChange={(e) => {
                          setAutoSave(e.target.checked);
                          localStorage.setItem('autoSave', e.target.checked);
                        }}
                      />
                    </label>
                  </div>
                </div>

                {/* Storage */}
                <div className="p-8 border-b border-gray-200">
                  <h3 className="text-base font-normal text-gray-900 mb-4">Storage</h3>
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Used: 2.4 GB of 15 GB</span>
                      <span className="text-gray-500">16% full</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: '16%' }}></div>
                    </div>
                  </div>
                  <button
                    onClick={handleManageStorage}
                    className="text-sm text-blue-600 hover:underline font-normal mt-2"
                  >
                    Manage storage
                  </button>
                </div>

                {/* Account Actions */}
                <div className="p-8">
                  <h3 className="text-base font-normal text-gray-900 mb-4">Account Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={handleChangePassword}
                      className="text-sm text-blue-600 hover:underline font-normal block"
                    >
                      Change password
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="text-sm text-red-600 hover:underline font-normal block"
                    >
                      Delete account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help & Feedback View */}
          {activeView === 'help' && (
            <div className="max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Help Resources */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center mb-4">
                    <HelpCircle size={24} className="text-blue-600 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">Help Resources</h3>
                  </div>
                  <div className="space-y-3">
                    <a href="#" className="block text-blue-600 hover:text-blue-700 text-sm">📚 Documentation</a>
                    <a href="#" className="block text-blue-600 hover:text-blue-700 text-sm">🎥 Video Tutorials</a>
                    <a href="#" className="block text-blue-600 hover:text-blue-700 text-sm">❓ FAQs</a>
                    <a href="#" className="block text-blue-600 hover:text-blue-700 text-sm">💬 Community Forum</a>
                  </div>
                </div>

                {/* Contact Support */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center mb-4">
                    <Users size={24} className="text-green-600 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">Contact Support</h3>
                  </div>
                  <div className="space-y-3">
                    <button className="w-full text-left text-blue-600 hover:text-blue-700 text-sm">📧 Email Support</button>
                    <button className="w-full text-left text-blue-600 hover:text-blue-700 text-sm">💬 Live Chat</button>
                    <button className="w-full text-left text-blue-600 hover:text-blue-700 text-sm">📞 Phone Support</button>
                    <button className="w-full text-left text-blue-600 hover:text-blue-700 text-sm">🎫 Submit a Ticket</button>
                  </div>
                </div>
              </div>

              {/* Send Feedback */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Feedback</h3>
                <p className="text-sm text-gray-600 mb-4">Help us improve SyncWrite by sharing your thoughts and suggestions.</p>
                <textarea
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows="5"
                  placeholder="Tell us what you think..."
                ></textarea>
                <div className="mt-4 flex justify-end">
                  <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                    Submit Feedback
                  </button>
                </div>
              </div>

              {/* What's New */}
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">🎉 What's New</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>✨ New sidebar navigation with Google Workspace style</li>
                  <li>📊 Sheets templates and spreadsheet management</li>
                  <li>🎨 Slides with presentation templates</li>
                  <li>🎥 Video recording and management</li>
                  <li>📋 Forms with survey templates</li>
                </ul>
              </div>
            </div>
          )}

          {/* Drive View */}
          {activeView === 'drive' && (
            <div>
              {/* Storage Overview */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Storage</h3>
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Manage storage
                  </button>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>2.4 GB of 15 GB used</span>
                    <span>12.6 GB available</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: '16%' }}></div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FileText size={20} className="text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Docs</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">1.2 GB</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Sheet size={20} className="text-green-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Sheets</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">0.5 GB</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Video size={20} className="text-purple-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Videos</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">0.6 GB</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <FolderOpen size={20} className="text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">Other</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">0.1 GB</p>
                  </div>
                </div>
              </div>

              {/* All Files */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-normal text-gray-700">My Drive</h3>
                  <div className="flex items-center space-x-2">
                    <select className="text-sm text-gray-600 border-none bg-transparent cursor-pointer">
                      <option>Name</option>
                      <option>Last modified</option>
                      <option>File size</option>
                    </select>
                  </div>
                </div>

                {/* Combined files view */}
                {[...ownedDocs, ...sharedDocs].length > 0 ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Modified</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {[...ownedDocs, ...sharedDocs].slice(0, 10).map(doc => (
                          <tr key={doc.id} className="hover:bg-gray-50 cursor-pointer">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <FileText size={20} className="text-blue-500 mr-3" />
                                <span className="text-sm font-medium text-gray-900">{doc.title}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{doc.Owner?.name || 'Unknown'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {format(new Date(doc.updatedAt), 'MMM d, yyyy')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                    <HardDrive size={64} className="mx-auto text-gray-300 mb-4" />
                    <h4 className="text-xl font-normal text-gray-700 mb-2">Your Drive is empty</h4>
                    <p className="text-gray-500 text-sm">Create documents, sheets, slides, or upload files to get started</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Change Password Modal ── */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <KeyRound size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
              </div>
              <button
                onClick={() => { setShowChangePassword(false); resetChangePassword(); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
              {/* Success message */}
              {pwSuccess && (
                <div className="flex items-center space-x-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
                  <Check size={16} className="flex-shrink-0" />
                  <span>Password changed successfully!</span>
                </div>
              )}

              {/* Error message */}
              {pwError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
                  {pwError}
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter new password"
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword && (() => {
                  const strength = getPasswordStrength(newPassword);
                  return (
                    <div className="mt-2">
                      <div className="flex space-x-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              i <= strength.score ? strength.color : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${
                        strength.score <= 2 ? 'text-red-500' :
                        strength.score === 3 ? 'text-yellow-600' :
                        strength.score === 4 ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {strength.label}
                      </p>
                    </div>
                  );
                })()}

                {/* Requirements checklist */}
                {newPassword && (
                  <ul className="mt-2 space-y-1">
                    {[
                      { rule: newPassword.length >= 8,           label: 'At least 8 characters' },
                      { rule: /[A-Z]/.test(newPassword),         label: 'One uppercase letter' },
                      { rule: /[a-z]/.test(newPassword),         label: 'One lowercase letter' },
                      { rule: /[0-9]/.test(newPassword),         label: 'One number' },
                      { rule: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword), label: 'One special character' },
                    ].map(({ rule, label }) => (
                      <li key={label} className={`flex items-center space-x-1.5 text-xs ${rule ? 'text-green-600' : 'text-gray-400'}`}>
                        <Check size={11} className={rule ? 'text-green-500' : 'text-gray-300'} />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm new password"
                    className={`w-full pr-10 pl-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-400 bg-red-50'
                        : confirmPassword && confirmPassword === newPassword
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-xs text-green-600 mt-1 flex items-center space-x-1">
                    <Check size={11} /> <span>Passwords match</span>
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowChangePassword(false); resetChangePassword(); }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwLoading || pwSuccess}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {pwLoading ? 'Changing...' : pwSuccess ? 'Changed!' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
