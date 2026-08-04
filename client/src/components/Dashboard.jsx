import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FileText, Plus, LogOut, Trash2, Edit2, Copy, Menu, X,
  Users, Clock, Star, Settings, HelpCircle, FolderOpen, HardDrive,
  Sheet, Presentation, Video, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user, api, logout } = useAuth();
  const [ownedDocs, setOwnedDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('docs');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await api.get('/documents');
      setOwnedDocs(res.data.ownedDocs);
      setSharedDocs(res.data.sharedDocs);
    } catch (err) {
      console.error(err);
    }
  };

  const createDoc = async () => {
    try {
      const res = await api.post('/documents', { title: 'Untitled Document' });
      navigate(`/document/${res.data.id}`);
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

  const renderDocCard = (doc, isOwner) => (
    <div key={doc.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 p-5">
      <Link to={`/document/${doc.id}`} className="block">
        <div className="flex items-center mb-4">
          <div className="p-3 bg-indigo-50 text-blue-600 rounded-lg mr-4">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 line-clamp-1">{doc.title}</h3>
            <p className="text-xs text-gray-500 mt-1">
              Created: {format(new Date(doc.createdAt || doc.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
            <p className="text-xs text-gray-500">
              Modified: {format(new Date(doc.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'docs' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <FileText size={22} className="text-blue-500" />
            <span className="text-base font-normal">Docs</span>
          </button>

          <button
            onClick={() => setActiveView('sheets')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'sheets' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Sheet size={22} className="text-green-500" />
            <span className="text-base font-normal">Sheets</span>
          </button>

          <button
            onClick={() => setActiveView('slides')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'slides' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Presentation size={22} className="text-yellow-500" />
            <span className="text-base font-normal">Slides</span>
          </button>

          <button
            onClick={() => setActiveView('vids')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'vids' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Video size={22} className="text-purple-500" />
            <span className="text-base font-normal">Vids</span>
          </button>

          <button
            onClick={() => setActiveView('forms')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-6 ${
              activeView === 'forms' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ClipboardList size={22} className="text-purple-600" />
            <span className="text-base font-normal">Forms</span>
          </button>

          {/* Settings Section */}
          <button 
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Settings size={22} className="text-gray-500" />
            <span className="text-base font-normal">Settings</span>
          </button>

          <button 
            onClick={() => setActiveView('help')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors mb-1 ${
              activeView === 'help' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <HelpCircle size={22} className="text-gray-500" />
            <span className="text-base font-normal">Help & Feedback</span>
          </button>

          <button 
            onClick={() => setActiveView('drive')}
            className={`w-full flex items-center space-x-4 px-4 py-3 rounded-lg transition-colors ${
              activeView === 'drive' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
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
                onClick={createDoc}
                className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all"
              >
                <Plus size={20} className="mr-2" /> New Document
              </button>
              <button
                onClick={logout}
                className="flex items-center text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
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
                  <button className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-yellow-400 to-green-400 opacity-20 rounded"></div>
                        <Plus size={48} className="text-green-600 relative z-10" />
                      </div>
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank spreadsheet</span>
                  </button>

                  {/* To-do list */}
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-all overflow-hidden cursor-pointer group">
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
                        <rect x="2" y="2" width="6" height="6" rx="1"/>
                        <rect x="12" y="2" width="6" height="6" rx="1"/>
                        <rect x="2" y="12" width="6" height="6" rx="1"/>
                        <rect x="12" y="12" width="6" height="6" rx="1"/>
                      </svg>
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded" title="List view">
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="2" y="3" width="16" height="2" rx="1"/>
                        <rect x="2" y="9" width="16" height="2" rx="1"/>
                        <rect x="2" y="15" width="16" height="2" rx="1"/>
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
                  <button className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <Plus size={48} className="text-yellow-600" />
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank presentation</span>
                  </button>

                  {/* Pitch Deck */}
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-yellow-500 transition-all overflow-hidden cursor-pointer group">
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
                  <button className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <Video size={32} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">New Recording</span>
                    <span className="text-xs text-gray-500 mt-1">Record your screen</span>
                  </button>

                  {/* Upload Video */}
                  <button className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                      <Plus size={32} className="text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Upload Video</span>
                    <span className="text-xs text-gray-500 mt-1">From your device</span>
                  </button>

                  {/* From Drive */}
                  <button className="bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-purple-500 transition-all p-8 flex flex-col items-center justify-center group">
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
                  <button className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all p-6 aspect-[3/4] flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 mb-3 flex items-center justify-center">
                      <Plus size={48} className="text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-700 text-center">Blank form</span>
                  </button>

                  {/* Contact Form */}
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
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
                  <div className="bg-white rounded-lg border border-gray-200 hover:border-purple-500 transition-all overflow-hidden cursor-pointer">
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
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900">Account Settings</h3>
                  <p className="text-sm text-gray-500 mt-1">Manage your account preferences and settings</p>
                </div>

                <div className="divide-y divide-gray-200">
                  {/* Profile Section */}
                  <div className="p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Profile Information</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input 
                          type="text" 
                          value={user.name} 
                          disabled 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input 
                          type="email" 
                          value={user.email} 
                          disabled 
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preferences */}
                  <div className="p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Preferences</h4>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm text-gray-700">Email notifications</span>
                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" defaultChecked />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm text-gray-700">Desktop notifications</span>
                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm text-gray-700">Auto-save documents</span>
                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" defaultChecked />
                      </label>
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Storage</h4>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Used: 2.4 GB of 15 GB</span>
                        <span>16% full</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: '16%'}}></div>
                      </div>
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Manage storage
                    </button>
                  </div>

                  {/* Account Actions */}
                  <div className="p-6">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Account Actions</h4>
                    <div className="space-y-3">
                      <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Change password
                      </button>
                      <br />
                      <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                        Delete account
                      </button>
                    </div>
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
                    <div className="bg-blue-600 h-3 rounded-full transition-all" style={{width: '16%'}}></div>
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
    </div>
  );
};

export default Dashboard;
