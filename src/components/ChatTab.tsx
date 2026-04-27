import React, { useState, useEffect, useRef } from 'react';
import { ChatModeType } from '../types';
import { Send, Pin, Sparkles } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

interface ChatTabProps {
  chatMode: ChatModeType;
  setChatMode: (mode: ChatModeType) => void;
  onSelectDm: (user: any) => void;
}

export function ChatTab({ chatMode, setChatMode, onSelectDm }: ChatTabProps) {
  const [globalInput, setGlobalInput] = useState('');
  const [globalMessages, setGlobalMessages] = useState<any[]>([]);
  const [dmList, setDmList] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chatMode !== 'global') return;
    
    const q = query(collection(db, 'global_chat'), orderBy('timestamp', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGlobalMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error("Error fetching global chat: ", error);
    });

    return () => unsubscribe();
  }, [chatMode]);

  const [pinnedChats, setPinnedChats] = useState<string[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      if (doc.exists()) {
        setPinnedChats(doc.data().pinnedChats || []);
      }
    }, (error) => {
      console.error("Error fetching pinned chats:", error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (chatMode !== 'dm' || !auth.currentUser) return;

    const currentUserId = auth.currentUser.uid;
    
    // We would ideally query dms where participants contains currentUser.uid
    const q = query(
      collection(db, 'dms'),
      where('participants', 'array-contains', currentUserId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chats = await Promise.all(snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((id: string) => id !== currentUserId) || currentUserId;
        
        let userInfo = { name: 'Unknown User', img: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80', online: false };
        
        if (otherUserId === 'nova_ai') {
           userInfo = { name: 'Nova (AI)', img: 'https://images.unsplash.com/photo-1531256379416-9f000e90a4fa?w=150&q=80', online: true };
        } else {
           const userDocRef = doc(db, 'users', otherUserId);
           const userDocSnap = await getDoc(userDocRef);
           if (userDocSnap.exists()) {
             const ud = userDocSnap.data();
             userInfo = { name: ud.displayName || ud.name || 'User', img: ud.photoURL || ud.avatar || userInfo.img, online: false };
           }
        }

        let msg = 'Start a conversation';
        let time = '';
        
        return {
          id: chatDoc.id,
          userId: otherUserId,
          name: userInfo.name,
          img: userInfo.img,
          online: userInfo.online,
          msg,
          time,
          unread: 0,
          isPinned: otherUserId === 'nova_ai' || pinnedChats.includes(chatDoc.id)
        };
      }));

      // Ensure Nova is always in the list
      if (!chats.some(c => c.userId === 'nova_ai')) {
        chats.push({
          id: 'nova_default',
          userId: 'nova_ai',
          name: 'Nova (AI)',
          img: 'https://images.unsplash.com/photo-1531256379416-9f000e90a4fa?w=150&q=80',
          online: true,
          msg: 'How can I help you today?',
          time: 'Just now',
          unread: 0,
          isPinned: true
        });
      }

      chats.sort((a, b) => {
        const aPinned = a.userId === 'nova_ai' || pinnedChats.includes(a.id);
        const bPinned = b.userId === 'nova_ai' || pinnedChats.includes(b.id);
        if (aPinned === bPinned) return 0;
        return aPinned ? -1 : 1;
      });
      
      setDmList(chats);
    });

    return () => unsubscribe();
  }, [chatMode, pinnedChats]);

  const togglePin = async (chat: any) => {
    if (!auth.currentUser || chat.userId === 'nova_ai') return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      let currentPinned = [] as string[];
      if (userSnap.exists()) {
        currentPinned = userSnap.data().pinnedChats || [];
      }
      
      if (currentPinned.includes(chat.id)) {
        currentPinned = currentPinned.filter(id => id !== chat.id);
      } else {
        currentPinned.push(chat.id);
      }
      
      await updateDoc(userRef, { pinnedChats: currentPinned });
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };
  
  const handleGlobalSend = async () => {
    if (!globalInput.trim() || !auth.currentUser) return;
    const msgData = {
      text: globalInput,
      userId: auth.currentUser.uid,
      userName: auth.currentUser.displayName || (auth.currentUser.isAnonymous ? 'Guest User' : 'User'),
      userAvatar: auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80',
      timestamp: Date.now()
    };
    
    setGlobalInput('');
    try {
      await addDoc(collection(db, 'global_chat'), msgData);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const formatTime = (ts: number) => {
    if (!ts) return 'Just now';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-slide-up flex flex-col flex-1 pb-4 relative md:max-w-2xl md:mx-auto md:w-full">
      {/* Header and Toggle */}
      <div className="flex flex-col items-center mb-8 shrink-0">
        <h2 className="text-[32px] font-serif font-semibold text-slate-900 tracking-tight mb-5">Chats</h2>
        
        {/* Sub-divisions Toggle */}
        <div className="flex p-1 bg-slate-200/50 rounded-full w-[260px] shadow-inner border border-black/5">
          <button 
            className={`flex-1 rounded-full py-1.5 text-[14px] font-bold transition-all duration-300 ${chatMode === 'global' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} 
            onClick={() => setChatMode('global')}
          >
            Global Chat
          </button>
          <button 
            className={`flex-1 rounded-full py-1.5 text-[14px] font-bold transition-all duration-300 ${chatMode === 'dm' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} 
            onClick={() => setChatMode('dm')}
          >
            DMs
          </button>
        </div>
      </div>

      {/* Message Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden px-1">
        
        {/* Global Chat Stream View */}
        {chatMode === 'global' && (
          <div className="flex-1 flex flex-col min-h-0 relative h-full">
            <div className="flex-1 overflow-y-auto space-y-0 pb-[100px]">
              {globalMessages.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">Say hi to everyone!</div>
              ) : (
                globalMessages.map((chat) => (
                  <div key={chat.id} className="flex gap-4 py-[18px] border-b border-black-[0.03] border-slate-200/60 last:border-0 relative">
                    <img src={chat.userAvatar} alt={chat.userName} className="w-[44px] h-[44px] object-cover rounded-full shadow-sm shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <span className="font-bold text-[15px] text-slate-900">{chat.userName}</span>
                        <span className="text-[12px] font-medium text-slate-500 mt-1">{formatTime(chat.timestamp)}</span>
                      </div>
                      <p className="text-[14.5px] text-slate-600 font-medium leading-snug">{chat.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            {/* Background Subtle Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-indigo-500/10 opacity-30 z-0 pointer-events-none" />
            {/* Global Input - Sticky at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-[60] pt-4 pb-2 app-bg-fade-secondary pointer-events-none">
              <div className="relative flex items-center shadow-[0_4px_25px_rgb(0,0,0,0.06)] rounded-full pointer-events-auto">
                <input 
                  type="text" 
                  value={globalInput}
                  onChange={(e) => setGlobalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGlobalSend()}
                  placeholder="Message global chat..." 
                  className="w-full bg-white backdrop-blur-xl rounded-full py-4 px-6 pr-14 text-[16px] font-medium text-slate-800 placeholder-slate-400 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-[#173e35]/20 transition-all font-sans shadow-sm"
                />
                <button 
                  onClick={handleGlobalSend}
                  disabled={!globalInput.trim()}
                  className={`absolute right-1.5 w-11 h-11 flex items-center justify-center rounded-full transition-all ${globalInput.trim() ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Traditional Direct Messages View */}
        {chatMode === 'dm' && (
          <div className="overflow-y-auto space-y-1 pb-4 flex-1">
             {dmList.length === 0 ? (
               <div className="text-center py-10 text-slate-400 font-medium">No messages yet.</div>
             ) : dmList.map((chat, i) => (
              <div 
                key={chat.id || i} 
                onClick={() => onSelectDm(chat)}
                className={`flex items-center gap-4 p-3 hover:bg-slate-100/50 rounded-2xl cursor-pointer transition-colors group ${chat.isPinned ? 'bg-indigo-50/40 border border-indigo-100/50' : ''}`}
              >
                <div className="relative">
                  <img src={chat.img} alt={chat.name} className="w-[52px] h-[52px] object-cover rounded-[20px] shadow-sm" />
                  {chat.unread > 0 && <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-rose-500 rounded-full border-2 border-white"></span>}
                  {chat.online && chat.unread === 0 && <span className="absolute -bottom-1 -right-1 w-[12px] h-[12px] bg-emerald-500 rounded-full border-2 border-white"></span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className={`text-[15px] flex items-center gap-1.5 ${chat.unread > 0 ? 'dark:text-white font-bold text-slate-900' : 'dark:text-slate-100 font-semibold text-slate-800'} truncate`}>
                      {chat.name}
                      {chat.name === 'Nova (AI)' && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
                    </h3>
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={(e) => { 
                           e.stopPropagation(); 
                           togglePin(chat); 
                         }} 
                         className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                       >
                         <Pin className={`w-3.5 h-3.5 ${(chat.isPinned && chat.name !== 'Nova (AI)') ? 'text-indigo-500 fill-indigo-500' : 'text-slate-400 dark:text-slate-500'} ${chat.isPinned ? 'rotate-45' : ''}`} />
                       </button>
                      <span className={`text-[11px] ${chat.unread > 0 ? 'text-rose-500 font-bold' : 'text-slate-400 font-medium dark:text-slate-500'}`}>{chat.time}</span>
                    </div>
                  </div>
                  <p className={`text-[13px] truncate ${chat.unread > 0 ? 'font-semibold text-slate-800' : (chat.isPinned ? 'text-indigo-600/80 font-medium' : 'text-slate-500')}`}>{chat.msg}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
