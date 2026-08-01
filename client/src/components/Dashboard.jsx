import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, LogOut, Trash2, Edit2, Copy } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user, api, logout } = useAuth();
  const [ownedDocs, setOwnedDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2 text-primary">
            <FileText size={28} />
            <h1 className="text-2xl font-bold tracking-tight">SyncWrite</h1>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-gray-600">Hello, {user.name}</span>
            <button
              onClick={logout}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut size={18} className="mr-1" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Your Documents</h2>
          <button
            onClick={createDoc}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg shadow-md transition-all"
          >
            <Plus size={20} className="mr-2" /> New Document
          </button>
        </div>

        {ownedDocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
            {ownedDocs.map(doc => renderDocCard(doc, true))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 mb-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
            <p className="text-gray-500 mt-1">Create your first document to get started.</p>
          </div>
        )}

        {sharedDocs.length > 0 && (
          <>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Shared with you</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sharedDocs.map(doc => renderDocCard(doc, false))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
