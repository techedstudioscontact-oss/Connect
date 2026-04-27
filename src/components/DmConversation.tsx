import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Phone, Video, Info, Smile, Paperclip, Send, Check, CheckCheck, Sparkles, Bot } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';

interface User {
  name: string;
  img: string;
  id?: string;
  userId?: string;
  online?: boolean;
}

interface DmConversationProps {
  user: User;
  onClose: () => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  sender: 'me' | 'them';
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  timestamp?: number;
  sharedPostId?: string;
}

function SharedPostPreview({ postId }: { postId: string }) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          setPost({ id: postSnap.id, ...postSnap.data() });
        }
      } catch (e) {
        console.error("Error fetching shared post:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [postId]);

  if (loading) return <div className="w-48 h-24 bg-slate-100 animate-pulse rounded-xl" />;
  if (!post) return <div className="p-2 text-xs text-slate-400 italic">Post no longer available</div>;

  return (
    <div className="w-56 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 mt-2 shadow-sm">
      {post.image && (
        <img src={post.image} alt="Shared post" className="w-full h-28 object-cover" />
      )}
      <div className="p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <img src={post.authorAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
          <span className="text-[11px] font-bold text-slate-700 truncate">{post.authorName}</span>
        </div>
        <p className="text-[12px] text-slate-600 line-clamp-2 leading-snug">{post.content}</p>
      </div>
    </div>
  );
}

export function DmConversation({ user, onClose }: DmConversationProps) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isNova = user.name === 'Nova (AI)' || user.userId === 'nova_ai' || user.id === 'nova_ai';
  // Use user.userId or user.id from the list, fallback to name parsing just in case
  let otherUserId = user.userId || user.id;
  if (!otherUserId) {
    otherUserId = isNova ? 'nova_ai' : user.name.replace(/\s+/g, '_').toLowerCase();
  }
  const currentUserId = auth.currentUser?.uid || 'guest';
  const chatId = [currentUserId, otherUserId].sort().join('_');

  useEffect(() => {
    if (!auth.currentUser) return;

    let unsubscribeSnapshot: (() => void) | undefined;

    const setupChat = async () => {
      try {
        const chatRef = doc(db, 'dms', chatId);
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            participants: [currentUserId, otherUserId],
            createdAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.error("Error setting up chat doc:", e);
      }

      const q = query(
        collection(db, `dms/${chatId}/messages`),
        orderBy('timestamp', 'asc')
      );

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => {
          const data = doc.data();
          let ts = data.timestamp;
          // Handle Firestore Timestamp vs number
          if (ts && typeof ts === 'object' && 'toDate' in ts) {
            ts = ts.toDate().getTime();
          }
          const msgTimeStr = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
          return {
            id: doc.id,
            text: data.text,
            senderId: data.senderId,
            sender: data.senderId === currentUserId ? 'me' : 'them',
            time: msgTimeStr,
            status: 'sent', 
            sharedPostId: data.sharedPostId
          } as Message;
        });

        // Provide initial mock message for AI if empty
        if (msgs.length === 0 && isNova) {
          setMessages([{
            id: 'initial',
            text: 'Hi! I am Nova, your AI assistant. How can I help you today?',
            senderId: 'nova_ai',
            sender: 'them',
            time: 'Just now'
          }]);
        } else {
          setMessages(msgs);
        }

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });
    };

    setupChat();

    return () => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [chatId, currentUserId, isNova, otherUserId]);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !auth.currentUser) return;
    
    const msgText = inputText.trim();
    setInputText('');

    try {
      await addDoc(collection(db, `dms/${chatId}/messages`), {
        text: msgText,
        senderId: currentUserId,
        timestamp: Date.now()
      });

      if (isNova) {
        setIsTyping(true);
        // Simulate Nova reply
        setTimeout(async () => {
          if (!isMounted.current) return;
          setIsTyping(false);
          await addDoc(collection(db, `dms/${chatId}/messages`), {
            text: 'I am currently a prototype, but soon I will be able to help you interact with our network!',
            senderId: 'nova_ai',
            timestamp: Date.now()
          });
        }, 2000);
      }
    } catch (e) {
      console.error("Error sending message", e);
    }
  };

  return (
    <div className="absolute inset-0 z-[200] app-bg-secondary dark:bg-[#0c1222] flex flex-col animate-slide-up pointer-events-auto">
      {/* Background Subtle Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-indigo-500/5 opacity-50 z-0 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-white/50 dark:border-slate-800/50 shadow-[0_2px_15px_rgb(0,0,0,0.03)] pt-10 sm:pt-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100/50 hover:bg-slate-200/50 text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <img src={user.img} alt={user.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
              {user.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
              )}
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1.5">
                {user.name}
                {user.name === 'Nova (AI)' && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
              </h2>
              <p className="text-[12px] font-medium text-emerald-600">
                {isTyping ? <span className="animate-pulse">typing...</span> : (user.online ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-600">
          {user.name !== 'Nova (AI)' && (
            <>
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <Video className="w-5 h-5" />
              </button>
            </>
          )}
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6 space-y-4 no-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.sender === 'me';
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[75%] flex-col gap-1">
                <div 
                  className={`p-3.5 px-5 text-[14.5px] leading-snug shadow-sm ${
                    isMe 
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-[24px] rounded-br-[8px]' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-[24px] rounded-bl-[8px] border border-slate-100 dark:border-slate-700'
                  }`}
                >
                  {msg.text}
                  {msg.sharedPostId && <SharedPostPreview postId={msg.sharedPostId} />}
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] font-medium text-slate-400 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span>{msg.time}</span>
                  {isMe && msg.status && (
                    <span>
                      {msg.status === 'read' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Check className="w-3.5 h-3.5" />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex justify-start animate-slide-up">
            <div className="flex max-w-[75%] flex-col gap-1">
              <div className="p-3.5 px-4 h-[44px] flex items-center justify-center gap-1 shadow-sm bg-white text-slate-800 rounded-[24px] rounded-bl-[8px] border border-slate-100">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-4 pb-8 sm:pb-6 bg-white/70 backdrop-blur-xl border-t border-white/50 space-y-3">
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative flex items-center">
            <div className="absolute left-3 text-slate-400">
              <Smile className="w-5 h-5" />
            </div>
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Message..." 
              className="w-full bg-white rounded-full py-3 pl-10 pr-12 text-[15px] font-medium text-slate-800 placeholder-slate-400 shadow-[0_2px_15px_rgb(0,0,0,0.04)] border border-slate-100 focus:outline-none focus:ring-2 focus:ring-[#173e35]/20 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={`absolute right-1.5 w-9 h-9 flex items-center justify-center rounded-full transition-all ${inputText.trim() ? 'bg-emerald-500 text-white shadow-md scale-100' : 'bg-slate-100 text-slate-400 scale-90 cursor-not-allowed'}`}
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
