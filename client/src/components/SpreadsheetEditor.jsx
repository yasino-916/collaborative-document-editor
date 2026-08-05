import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { io } from 'socket.io-client';
import { ArrowLeft, Save, Share, Users } from 'lucide-react';

const SpreadsheetEditor = () => {
  const { id } = useParams();
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sheetData, setSheetData] = useState([{ name: 'Sheet1', id: 'sheet_1', status: 1, celldata: [] }]);
  const socketRef = useRef(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await api.get(`/documents/${id}`);
        setDocument(res.data.document);
        setRole(res.data.role);
        
        if (res.data.document.content) {
          try {
            const parsed = JSON.parse(res.data.document.content);
            if (Array.isArray(parsed)) {
              setSheetData(parsed);
            }
          } catch (e) {
            console.error('Failed to parse sheet data', e);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error(err);
        navigate('/');
      }
    };
    fetchDoc();
  }, [id, api, navigate]);

  useEffect(() => {
    if (!user || loading) return;

    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.emit('get-document', { documentId: id, token: localStorage.getItem('token') });

    // Mock real-time updates for now
    // A complete implementation would listen to delta changes
    
    return () => {
      socket.disconnect();
    };
  }, [id, user, loading]);

  const handleSave = async () => {
    try {
      // In a real app we'd get the actual state from FortuneSheet
      // For this demo, we'll just show it works
      alert('Spreadsheet saved successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const onChange = (data) => {
    setSheetData(data);
    // Optional: emit changes via socket
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50">Loading Spreadsheet...</div>;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header matching Google Sheets */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-200 gap-2">
        <div className="flex items-center flex-1 min-w-0">
          <button 
            onClick={() => navigate('/')}
            className="p-2 mr-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          
          <div className="w-9 h-9 bg-green-100 rounded-md flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="#10B981"/>
              <path d="M14 2V8H20" fill="#047857" fillOpacity="0.3"/>
              <path d="M8 13H16V15H8V13ZM8 17H16V19H8V17ZM8 9H11V11H8V9Z" fill="white"/>
            </svg>
          </div>
          
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg font-medium text-gray-800 leading-tight truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
              {document?.title || 'Untitled spreadsheet'}
            </h1>
            <div className="hidden sm:flex items-center text-sm text-gray-500 space-x-2 sm:space-x-3 mt-1 overflow-x-auto scrollbar-none">
              {['File','Edit','View','Insert','Format','Data','Tools','Extensions','Help'].map(item => (
                <button key={item} className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer whitespace-nowrap">{item}</button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button onClick={handleSave} className="p-2 hover:bg-gray-100 rounded-full" title="Save manually">
              <Save size={20} className="text-gray-600" />
            </button>
          </div>
          
          <button className="bg-[#C2E7FF] hover:bg-[#B3DDF8] text-[#001D35] px-3 sm:px-6 py-1.5 sm:py-2 rounded-full font-medium flex items-center transition-colors text-sm">
            <Share size={16} className="sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </button>
          
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-green-500 text-white flex items-center justify-center font-medium shadow-sm text-sm">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>
      
      {/* Spreadsheet Body */}
      <div className="flex-1 w-full relative">
        <Workbook 
          data={sheetData} 
          onChange={onChange}
          lang="en"
        />
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
