import React, { useState, useEffect } from 'react';
import { ChevronLeft, UserPlus, Heart, MessageCircle, Check, X } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { formatTime } from '../lib/utils';

interface NotificationsModalProps {
  onClose: () => void;
}

export function NotificationsModal({ onClose }: NotificationsModalProps) {
  const [requests, setRequests] = useState<any[]>([]);

  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'friend_requests'), 
      where('to', '==', auth.currentUser.uid)
    );
    
    const unsubscribeReqs = onSnapshot(q, (snapshot) => {
      const incomingRequests = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((req: any) => req.status === 'pending');
      setRequests(incomingRequests);
    }, (error) => {
      console.error("Error fetching requests:", error);
    });

    const notifQ = query(
      collection(db, 'notifications'),
      where('to', '==', auth.currentUser.uid)
    );

    const unsubscribeNotifs = onSnapshot(notifQ, (snapshot) => {
      const notifs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => b.timestamp - a.timestamp);
      setNotifications(notifs);
    }, (error) => {
      console.error("Error fetching notifications:", error);
    });

    return () => {
      unsubscribeReqs();
      unsubscribeNotifs();
    };
  }, []);

  const handleRequest = async (id: string, action: 'accept' | 'decline') => {
    try {
      const reqRef = doc(db, 'friend_requests', id);
      await updateDoc(reqRef, { status: action === 'accept' ? 'accepted' : 'declined' });
    } catch (e) {
      console.error("Error updating friend request:", e);
    }
  };

  return (
    <div className="absolute inset-0 z-[150] bg-[#faf9f6]/95 backdrop-blur-md flex flex-col animate-slide-up pointer-events-auto">
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 border-b border-slate-200/50 pt-10 sm:pt-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-[20px] font-bold text-slate-900">Notifications</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 md:max-w-2xl md:mx-auto md:w-full">
        
        {/* Friend Requests Section */}
        {requests.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-slate-900 px-1">Friend Requests</h3>
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
              {requests.map((req, i) => (
                <div key={req.id} className={`flex items-center justify-between p-4 ${i !== 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="flex items-center gap-3">
                    <img src={req.fromImg} alt={req.fromName} className="w-[42px] h-[42px] rounded-full object-cover shadow-sm bg-slate-100" />
                    <div>
                      <h4 className="text-[14px] font-bold text-slate-900 leading-tight">{req.fromName}</h4>
                      <p className="text-[12px] font-medium text-slate-500">Wants to be friends</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleRequest(req.id, 'accept')}
                      className="w-9 h-9 flex items-center justify-center bg-emerald-500 text-white rounded-full shadow-sm hover:bg-emerald-600 transition-colors"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleRequest(req.id, 'decline')}
                      className="w-9 h-9 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Section */}
        <div className="space-y-4">
          <h3 className="text-[15px] font-bold text-slate-900 px-1">Recent</h3>
          <div className="bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
            {notifications.map((notif, i) => (
              <div key={notif.id} className={`flex items-start gap-4 p-4 ${i !== 0 ? 'border-t border-slate-100' : ''}`}>
                <div className="relative">
                  <img src={notif.fromAvatar || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'} alt={notif.fromName} className="w-[42px] h-[42px] rounded-full object-cover shadow-sm bg-slate-100" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                    {notif.type === 'like' && <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />}
                    {notif.type === 'comment' && <MessageCircle className="w-3.5 h-3.5 text-blue-500 fill-blue-500" />}
                  </div>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[13.5px] text-slate-800 leading-snug">
                    <span className="font-bold">{notif.fromName}</span> {notif.type === 'like' ? 'liked your post.' : 'commented on your post.'}
                  </p>
                  <span className="text-[11px] font-medium text-slate-400 mt-1 block">
                    {formatTime(notif.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
