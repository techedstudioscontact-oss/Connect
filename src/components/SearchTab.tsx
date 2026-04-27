import React, { useState, useEffect } from 'react';
import { Search, Compass, UserPlus, Check, MessageSquare, Clock } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, limit, getDocs, where, addDoc, onSnapshot } from 'firebase/firestore';

interface SearchTabProps {
  onSelectDm?: (user: any) => void;
}

export function SearchTab({ onSelectDm }: SearchTabProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'people' | 'posts'>('people');
  
  useEffect(() => {
    let unsubscribeUsers = () => {};
    let unsubscribeReq = () => {};

    const q = query(collection(db, 'users'), limit(50));
    unsubscribeUsers = onSnapshot(q, (snap) => {
      const fetchedUsers = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== auth.currentUser?.uid);
      setUsers(fetchedUsers);
    }, (err) => console.error("Error fetching users:", err));

    const postsQ = query(collection(db, 'posts'), limit(50));
    getDocs(postsQ).then(postsSnap => {
      const fetchedPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(fetchedPosts);
    });

    if (auth.currentUser) {
       const uid = auth.currentUser.uid;
       const reqQ = query(collection(db, 'friend_requests'), where('from', '==', uid));
       unsubscribeReq = onSnapshot(reqQ, (reqSnap) => {
         const pending = [] as string[];
         const accepted = [] as string[];
         reqSnap.docs.forEach(d => {
           const data = d.data();
           if (data.status === 'pending') pending.push(data.to);
           if (data.status === 'accepted') accepted.push(data.to);
         });

         const myReqQ = query(collection(db, 'friend_requests'), where('to', '==', uid));
         getDocs(myReqQ).then(myReqSnap => {
           myReqSnap.docs.forEach(d => {
             if (d.data().status === 'accepted') {
               accepted.push(d.data().from);
             }
           });
           setPendingRequests(pending);
           setFriends(accepted);
         });
       }, (err) => console.error("Error fetching requests:", err));
    }

    return () => {
      unsubscribeUsers();
      unsubscribeReq();
    };
  }, []);

  const filteredUsers = users.filter((u: any) => 
    !searchQuery || 
    (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPosts = posts.filter((p: any) => 
    !searchQuery ||
    (p.content && p.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.authorName && p.authorName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const startMessage = (user: any) => {
    if (onSelectDm) {
      onSelectDm({
        name: user.displayName || 'User',
        img: user.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80',
        id: user.id
      });
    }
  };

  const sendFriendRequest = async (user: any) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'friend_requests'), {
        from: auth.currentUser.uid,
        fromName: auth.currentUser.displayName || 'User',
        fromImg: auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80',
        to: user.id,
        status: 'pending',
        timestamp: Date.now()
      });
      setPendingRequests(prev => [...prev, user.id]);
    } catch (e) {
      console.error("Error sending friend request", e);
    }
  };

  return (
    <div className="animate-slide-up pb-10 md:max-w-2xl md:mx-auto">
      <div className="relative mb-6 text-slate-600">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..." 
          className="w-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_2px_15px_rgb(0,0,0,0.04)] rounded-full py-3.5 pl-12 pr-4 text-[16px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#173e35]/20 focus:bg-white transition-all"
        />
      </div>

      <div className="flex gap-4 mb-6 px-1">
        <button 
          onClick={() => setActiveTab('people')}
          className={`text-[15px] font-bold pb-2 border-b-[3px] transition-colors ${activeTab === 'people' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          People
        </button>
        <button 
          onClick={() => setActiveTab('posts')}
          className={`text-[15px] font-bold pb-2 border-b-[3px] transition-colors ${activeTab === 'posts' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Posts
        </button>
      </div>
      
      <div className="space-y-4">
        {activeTab === 'people' ? (
          filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">No users found.</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="bg-white/80 backdrop-blur-xl rounded-[32px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 relative flex-1 min-w-0 mr-2">
                      <img src={user.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'} alt={user.displayName} className="w-[48px] h-[48px] object-cover rounded-full shadow-sm shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[15px] font-bold text-slate-900 leading-tight mb-0.5 truncate">{user.displayName || 'Guest User'}</h3>
                        <p className="text-[13px] text-slate-500 font-medium">User</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button 
                        onClick={() => startMessage(user)}
                        className="bg-emerald-100 text-emerald-700 font-bold w-10 h-10 rounded-full shadow-sm hover:bg-emerald-200 transition-colors flex items-center justify-center shrink-0"
                        title="Message"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      
                      {friends.includes(user.id) ? (
                         <div className="bg-slate-100 text-slate-600 font-bold w-10 h-10 rounded-full shadow-sm flex items-center justify-center" title="Friends">
                           <Check className="w-5 h-5" />
                         </div>
                      ) : pendingRequests.includes(user.id) ? (
                         <div className="bg-slate-100 text-slate-500 font-bold w-10 h-10 rounded-full shadow-sm flex items-center justify-center" title="Request Sent">
                           <Clock className="w-5 h-5" />
                         </div>
                      ) : (
                         <button 
                           onClick={() => sendFriendRequest(user)}
                           className="bg-slate-900 text-white font-bold w-10 h-10 rounded-full shadow-sm hover:bg-slate-800 transition-colors flex items-center justify-center"
                           title="Add Friend"
                         >
                           <UserPlus className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                </div>
              </div>
            ))
          )
        ) : (
          filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 font-medium">No posts found.</div>
          ) : (
            filteredPosts.map((post) => (
              <div key={post.id} className="bg-white/80 backdrop-blur-xl rounded-[32px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
                <div className="flex items-center gap-3 mb-3">
                  <img src={post.authorAvatar || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'} alt="Author" className="w-[36px] h-[36px] object-cover rounded-full shadow-sm" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-[14px]">{post.authorName}</h3>
                  </div>
                </div>
                <p className="text-[14px] text-slate-800 mb-2">{post.content}</p>
                {post.image && (
                  <img src={post.image} alt="Post content" className="w-full h-48 object-cover rounded-[16px] mb-2" />
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
