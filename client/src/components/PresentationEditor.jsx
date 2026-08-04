import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { 
  ArrowLeft, Save, Share, Play, Type, Image as ImageIcon, 
  Square, Circle, MoreHorizontal, MousePointer2, Plus
} from 'lucide-react';

const PresentationEditor = () => {
  const { id } = useParams();
  const { user, api } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await api.get(`/documents/${id}`);
        setDocument(res.data.document);
        setRole(res.data.role);
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
    
    return () => {
      socket.disconnect();
    };
  }, [id, user, loading]);

  const handleSave = () => {
    alert('Presentation saved successfully!');
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50">Loading Presentation...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center flex-1">
          <button 
            onClick={() => navigate('/')}
            className="p-2 mr-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          
          <div className="w-10 h-10 bg-yellow-100 rounded-md flex items-center justify-center mr-3 flex-shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="#F59E0B"/>
              <path d="M7 7H17V9H7V7ZM7 11H17V13H7V11ZM7 15H14V17H7V15Z" fill="#D97706"/>
            </svg>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center">
              <h1 className="text-lg font-medium text-gray-800 leading-tight border border-transparent hover:border-gray-300 px-1 rounded truncate max-w-[200px] cursor-text">
                {document?.title || 'Untitled presentation'}
              </h1>
              <Star size={16} className="text-gray-400 hover:text-gray-600 ml-2 cursor-pointer" />
            </div>
            <div className="flex items-center text-sm text-gray-700 space-x-1 mt-0.5">
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">File</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Edit</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">View</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Insert</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Format</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Slide</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Arrange</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Tools</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Extensions</button>
              <button className="hover:bg-gray-100 px-2 py-0.5 rounded cursor-pointer">Help</button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button className="p-2 hover:bg-gray-100 rounded-full" title="Comments">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </button>
          <button className="flex items-center bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-1.5 rounded-full font-medium transition-colors">
            <Play size={16} className="mr-2" /> Slideshow <span className="ml-2 border-l border-gray-300 pl-2">▼</span>
          </button>
          <button className="bg-[#C2E7FF] hover:bg-[#B3DDF8] text-[#001D35] px-6 py-2 rounded-full font-medium flex items-center transition-colors shadow-sm">
            <Share size={18} className="mr-2" /> Share
          </button>
          <div className="w-9 h-9 rounded-full bg-yellow-500 text-white flex items-center justify-center font-medium shadow-sm">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center px-4 py-1 bg-[#edf2fa] border-b border-gray-200 space-x-1 rounded-full mx-4 mt-2">
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Plus size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><ArrowLeft size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700 transform rotate-180"><ArrowLeft size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></button>
        
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        
        <button className="p-1.5 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"><MousePointer2 size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Type size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><ImageIcon size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Square size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><Circle size={18} /></button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700 font-serif font-bold text-lg leading-none">T</button>
        <button className="p-1.5 hover:bg-gray-200 rounded text-gray-700"><MoreHorizontal size={18} /></button>
        
        <div className="w-px h-5 bg-gray-300 mx-1"></div>
        
        <button className="px-3 py-1.5 hover:bg-gray-200 rounded text-gray-700 text-sm font-medium">Background</button>
        <button className="px-3 py-1.5 hover:bg-gray-200 rounded text-gray-700 text-sm font-medium">Layout</button>
        <button className="px-3 py-1.5 hover:bg-gray-200 rounded text-gray-700 text-sm font-medium">Theme</button>
        <button className="px-3 py-1.5 hover:bg-gray-200 rounded text-gray-700 text-sm font-medium">Transition</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Thumbnails) */}
        <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex flex-col p-2 space-y-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10">
          <div className="flex items-start cursor-pointer group">
            <span className="text-xs text-gray-500 font-medium w-4 pt-1">1</span>
            <div className="flex-1 ml-1 aspect-[16/9] border-2 border-blue-500 rounded-md overflow-hidden bg-white shadow-sm flex items-center justify-center p-2 relative">
               <div className="absolute top-1 left-2 w-3/4 h-1 bg-gray-200 rounded-sm"></div>
               <div className="absolute top-3 left-2 w-1/2 h-0.5 bg-gray-200 rounded-sm"></div>
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#f1f3f4] overflow-auto flex items-center justify-center p-8 relative">
           {/* Rulers */}
           <div className="absolute top-0 left-0 right-0 h-6 bg-white border-b border-gray-200 flex items-end overflow-hidden z-10">
             <div className="flex w-full ml-6">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="flex-1 h-2 border-l border-gray-400 relative">
                     <span className="absolute -top-4 left-1 text-[10px] text-gray-500">{i}</span>
                  </div>
                ))}
             </div>
           </div>
           <div className="absolute top-0 left-0 bottom-0 w-6 bg-white border-r border-gray-200 flex flex-col items-end overflow-hidden z-10">
             <div className="flex flex-col h-full mt-6">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="flex-1 w-2 border-t border-gray-400 relative">
                     <span className="absolute -top-1 left-2 text-[10px] text-gray-500">{i}</span>
                  </div>
                ))}
             </div>
           </div>

           {/* Canvas */}
           <div className="bg-white shadow-md aspect-[16/9] w-full max-w-4xl relative border border-gray-200 mt-6 ml-6 flex flex-col items-center justify-center p-12">
              <div className="w-4/5 border border-transparent hover:border-gray-300 p-4 rounded text-center cursor-text">
                 <h2 className="text-5xl font-medium text-black mb-4">Click to add title</h2>
              </div>
              <div className="w-3/5 border border-transparent hover:border-gray-300 p-4 rounded text-center cursor-text mt-4">
                 <p className="text-2xl text-gray-600">Click to add subtitle</p>
              </div>
           </div>
           
           {/* Speaker Notes */}
           <div className="absolute bottom-0 left-0 right-0 h-12 bg-white border-t border-gray-200 flex items-center px-4">
              <span className="text-sm text-gray-500">Click to add speaker notes</span>
           </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-16 bg-white border-l border-gray-200 flex flex-col items-center py-4 space-y-6">
           <div className="flex flex-col items-center cursor-pointer text-gray-600 hover:text-blue-600 group">
             <ImageIcon size={20} className="mb-1" />
             <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Image</span>
           </div>
           <div className="flex flex-col items-center cursor-pointer text-gray-600 hover:text-blue-600 group">
             <Square size={20} className="mb-1" />
             <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Templates</span>
           </div>
           <div className="flex flex-col items-center cursor-pointer text-gray-600 hover:text-blue-600 group">
             <Type size={20} className="mb-1" />
             <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Blocks</span>
           </div>
           <div className="w-8 border-b border-gray-200"></div>
           <div className="flex flex-col items-center cursor-pointer text-gray-600 hover:text-blue-600 group">
             <Plus size={20} className="mb-1" />
             <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Add-ons</span>
           </div>
        </div>
      </div>
    </div>
  );
};

function Star(props) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );
}

export default PresentationEditor;
