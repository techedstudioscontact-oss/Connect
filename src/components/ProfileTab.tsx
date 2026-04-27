import React, { useState, useRef, useEffect } from 'react';
import { LayoutGrid, Heart, Camera, X, Settings } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { uploadMedia } from '../lib/firebaseUtils';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { formatTime } from '../lib/utils';

interface ProfileTabProps {
  onEditProfile?: () => void;
  onOpenSettings?: () => void;
}

export function ProfileTab({ onEditProfile, onOpenSettings }: ProfileTabProps) {
  const [profilePic, setProfilePic] = useState('https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'liked'>('posts');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  useEffect(() => {
    if (auth.currentUser) {
      setProfilePic(auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80');
      
      const q = query(
        collection(db, 'posts'), 
        where('authorId', '==', auth.currentUser.uid),
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a: any, b: any) => b.timestamp - a.timestamp);
        setUserPosts(msgs);
      }, (error) => {
        console.error("Error fetching user posts: ", error);
      });

      const likedQ = query(
        collection(db, 'posts'),
        where('likedBy', 'array-contains', auth.currentUser.uid)
      );

      const unsubscribeLiked = onSnapshot(likedQ, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((a: any, b: any) => b.timestamp - a.timestamp);
        setLikedPosts(msgs);
      }, (error) => {
        console.error("Error fetching liked posts: ", error);
      });

      return () => {
        unsubscribe();
        unsubscribeLiked();
      };
    }
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && auth.currentUser) {
      setUploading(true);
      try {
        const { url } = await uploadMedia(file, auth.currentUser.uid, 'profile');
        setProfilePic(url);
        
        await updateProfile(auth.currentUser, { photoURL: url });
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, { photoURL: url }, { merge: true });
        
        // Dispatch event so the main App header updates instantly
        window.dispatchEvent(new Event('profileUpdated'));
      } catch (err) {
        console.error("Error uploading profile pic:", err);
      } finally {
        setUploading(false);
      }
    }
  };

  const currentUserName = auth.currentUser?.displayName || (auth.currentUser?.isAnonymous ? 'Guest User' : 'User');
  const currentUserUsername = `@${auth.currentUser?.uid.substring(0, 8)}`;

  return (
    <div className="animate-slide-up pb-10 md:max-w-2xl md:mx-auto">
      
      <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60 flex flex-col items-center text-center mb-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#bbf5d8]/40 to-transparent"></div>
        
        {/* Settings button added here */}
        <button 
          onClick={onOpenSettings}
          className="absolute top-5 right-5 z-20 w-10 h-10 bg-white/60 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/40 hover:bg-white/80 transition-all text-slate-700 hover:text-slate-900"
        >
          <Settings className="w-5 h-5" strokeWidth={2.5} />
        </button>
        
        <div className="relative z-10 mb-4 group">
          <img src={profilePic} alt="Profile" className={`w-24 h-24 object-cover rounded-[32px] shadow-lg border-4 border-white transition-opacity ${uploading ? 'opacity-50' : 'group-hover:opacity-80'}`} />
          {(uploading) ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-[32px]"
            >
              <div className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Camera className="w-4 h-4 text-slate-800" />
              </div>
            </button>
          )}
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageChange}
          />
        </div>
        <h2 className="text-[22px] font-black text-slate-900 leading-tight">{currentUserName}</h2>
        <p className="text-[14px] text-slate-500 font-semibold mb-6">{currentUserUsername}</p>
        
        <div className="flex w-full justify-center gap-8 mb-6">
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black text-slate-900">{userPosts.length}</span>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Posts</span>
          </div>
          <div className="w-[1px] bg-slate-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black text-slate-900">0</span>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Followers</span>
          </div>
          <div className="w-[1px] bg-slate-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-[20px] font-black text-slate-900">0</span>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">Following</span>
          </div>
        </div>

        <button 
          onClick={onEditProfile}
          className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
           Edit Profile
        </button>
      </div>

      <div className="flex items-center justify-center gap-12 mb-4 px-2 border-b border-black/10 pb-0">
        <button 
          onClick={() => setActiveTab('posts')}
          className={`text-[15px] font-bold flex items-center gap-2 pb-[12px] -mb-[1px] transition-colors ${activeTab === 'posts' ? 'text-slate-900 border-b-[3px] border-slate-900' : 'text-slate-400 hover:text-slate-600 border-b-[3px] border-transparent'}`}
        >
          <LayoutGrid className="w-4 h-4" /> Posts
        </button>
        <button 
          onClick={() => setActiveTab('liked')}
          className={`text-[15px] font-bold flex items-center gap-2 pb-[12px] -mb-[1px] transition-colors ${activeTab === 'liked' ? 'text-slate-900 border-b-[3px] border-slate-900' : 'text-slate-400 hover:text-slate-600 border-b-[3px] border-transparent'}`}
        >
          <Heart className="w-4 h-4" /> Liked
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 px-1">
        {(activeTab === 'posts' ? userPosts : likedPosts).length === 0 ? (
          <div className="col-span-3 text-center py-12 text-slate-400 font-medium bg-slate-50/50 rounded-2xl mx-2 border border-slate-100">
            {activeTab === 'posts' ? 'No posts yet.' : 'No liked posts.'}
          </div>
        ) : (
          (activeTab === 'posts' ? userPosts : likedPosts).map((post, i) => (
            <div 
              key={post.id} 
              onClick={() => setSelectedPost(post)}
              className="aspect-square bg-slate-100 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
            >
              {post.image ? (
                <img src={post.image} alt={`Post ${i}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-indigo-50 to-blue-50">
                  <p className="text-[10px] sm:text-xs text-slate-600 font-medium line-clamp-4 leading-relaxed max-w-[90%]">{post.content}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                  <Heart className="w-4 h-4 fill-white text-white" /> {post.likes || 0}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedPost && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPost(null); }}>
          <button 
            onClick={() => setSelectedPost(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <img src={selectedPost.authorAvatar || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'} alt="Author" className="w-10 h-10 rounded-full object-cover" />
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 text-[14px]">{selectedPost.authorName}</h3>
                <p className="text-[12px] text-slate-500">{formatTime(selectedPost.timestamp)}</p>
              </div>
            </div>
            {selectedPost.image ? (
              <div className="flex-shrink-0 bg-slate-100 aspect-square">
                <img src={selectedPost.image} alt="Post content" className="w-full h-full object-cover" />
              </div>
            ) : null}
            <div className="p-4 overflow-y-auto">
              {selectedPost.content && (
                <p className="text-[14.5px] text-slate-800 leading-relaxed font-medium mb-3">
                  <span className="font-bold text-slate-900 mr-2">{selectedPost.authorName}</span>
                  {selectedPost.content}
                </p>
              )}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 text-slate-600">
                <div className="flex items-center gap-2">
                  <Heart className={`w-5 h-5 ${selectedPost.likedBy?.includes(auth.currentUser?.uid || '') ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span className="font-bold text-[14px]">{selectedPost.likes || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
