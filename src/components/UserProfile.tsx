import React, { useState, useEffect } from 'react';
import { ChevronLeft, MessageSquare, Shield, Share2, MoreHorizontal, Heart, MessageCircle } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, doc, getDoc, setDoc, deleteDoc, updateDoc, increment, getDocs } from 'firebase/firestore';
import { formatTime } from '../lib/utils';

interface UserProfileProps {
  user: {
    id: string;
    name: string;
    avatar: string;
    username?: string;
  };
  onClose: () => void;
  onMessage: (user: any) => void;
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80";

export function UserProfile({ user, onClose, onMessage }: UserProfileProps) {
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    // Fetch full user details from Firestore
    const fetchUserDetails = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.id));
        if (userDoc.exists()) {
          setUserDetails(userDoc.data());
        }
      } catch (e) {
        console.error("Error fetching user details:", e);
      }
    };

    // Fetch followers/following real data
    const followersRef = collection(db, `users/${user.id}/followers`);
    const followingRef = collection(db, `users/${user.id}/following`);
    
    const unsubFollowers = onSnapshot(followersRef, (snap) => setFollowerCount(snap.size));
    const unsubFollowing = onSnapshot(followingRef, (snap) => setFollowingCount(snap.size));

    // Check if current user is following this profile
    if (auth.currentUser) {
      const followCheckRef = doc(db, `users/${user.id}/followers`, auth.currentUser.uid);
      onSnapshot(followCheckRef, (doc) => setIsFollowing(doc.exists()));
    }

    fetchUserDetails();
    return () => {
      unsubPosts();
      unsubFollowers();
      unsubFollowing();
    };
  }, [user.id]);

  const handleFollow = async () => {
    if (!auth.currentUser || isFollowLoading) return;
    setIsFollowLoading(true);
    const myId = auth.currentUser.uid;
    const targetId = user.id;

    try {
      if (isFollowing) {
        // Unfollow
        await deleteDoc(doc(db, `users/${targetId}/followers`, myId));
        await deleteDoc(doc(db, `users/${myId}/following`, targetId));
      } else {
        // Follow
        await setDoc(doc(db, `users/${targetId}/followers`, myId), { timestamp: Date.now() });
        await setDoc(doc(db, `users/${myId}/following`, targetId), { timestamp: Date.now() });
      }
    } catch (e) {
      console.error("Error toggling follow:", e);
    } finally {
      setIsFollowLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[300] bg-slate-50 dark:bg-[#0c1222] flex flex-col animate-slide-up overflow-y-auto no-scrollbar">
      {/* Header Image/Background */}
      <div className="relative h-48 shrink-0 bg-gradient-to-br from-emerald-400 to-indigo-600">
        <button 
          onClick={onClose}
          className="absolute top-10 left-5 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors z-20"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="absolute top-10 right-5 flex gap-2 z-20">
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-full bg-black/20 backdrop-blur-md text-white">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="relative px-5 pb-10">
        {/* Avatar */}
        <div className="absolute -top-12 left-5">
          <div className="relative p-1.5 bg-slate-50 dark:bg-[#0c1222] rounded-[38px] shadow-xl">
            <img 
              src={userDetails?.photoURL || user.avatar || DEFAULT_AVATAR} 
              className="w-24 h-24 rounded-[32px] object-cover border-2 border-white/20"
              alt={user.name}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4 gap-3">
          {auth.currentUser?.uid !== user.id && (
            <button 
              onClick={handleFollow}
              disabled={isFollowLoading}
              className={`px-8 py-2.5 rounded-full font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                isFollowing 
                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' 
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
              }`}
            >
              {isFollowLoading ? '...' : (isFollowing ? 'Following' : 'Follow')}
            </button>
          )}
          <button 
            onClick={() => onMessage(user)}
            className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" /> Message
          </button>
        </div>

        {/* Text Info */}
        <div className="mt-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            {userDetails?.displayName || user.name}
            <Shield className="w-5 h-5 text-emerald-500" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
            @{user.id.substring(0, 8)}
          </p>
          
          <p className="mt-4 text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            {userDetails?.bio || "Hey there! I am using Connact to build a better future. 🚀"}
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-8 mt-6 py-4 border-y border-slate-200 dark:border-slate-800">
          <div>
            <span className="block text-xl font-black text-slate-900 dark:text-white">{userPosts.length}</span>
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Posts</span>
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900 dark:text-white">{followerCount}</span>
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Followers</span>
          </div>
          <div>
            <span className="block text-xl font-black text-slate-900 dark:text-white">{followingCount}</span>
            <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">Following</span>
          </div>
        </div>

        {/* User's Posts Feed */}
        <div className="mt-8">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6">Recent Posts</h2>
          
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : userPosts.length === 0 ? (
            <div className="text-center py-10 text-slate-400 font-medium bg-white/50 dark:bg-slate-800/30 rounded-3xl border border-white/60 dark:border-slate-700 shadow-sm">
              No posts from this user yet.
            </div>
          ) : (
            <div className="space-y-6">
              {userPosts.map(post => (
                <div key={post.id} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[32px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60 dark:border-slate-700">
                  {post.content && (
                    <p className="text-[14px] text-slate-800 dark:text-slate-200 font-semibold mb-3 px-1">{post.content}</p>
                  )}
                  {post.image && (
                    <div className="rounded-[24px] overflow-hidden mb-3">
                      <img src={post.image} className="w-full h-48 object-cover" alt="" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-[13px] font-bold text-slate-500">
                    <div className="flex items-center gap-1"><Heart className="w-4 h-4" /> {post.likes || 0}</div>
                    <div className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {post.comments || 0}</div>
                    <div className="ml-auto text-[11px] opacity-70">{formatTime(post.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
