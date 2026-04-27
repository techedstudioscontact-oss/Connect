import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart, MessageCircle, Send, MoreHorizontal, Play, Image as ImageIcon, Video, MapPin, X, Search, CheckCircle2, Circle, Trash2, Edit2, ChevronDown } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { getGreeting, formatTime } from '../lib/utils';
import { collection, addDoc, query, orderBy, onSnapshot, limit, doc, updateDoc, deleteDoc, getDocs, getDoc, setDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { Link as LinkIcon, Flag } from 'lucide-react';
import { uploadMedia } from '../lib/firebaseUtils';

interface Post {
  id: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  author: {
    name: string;
    username: string;
    avatar: string;
    id: string;
  };
  content?: string;
  image?: string;
  isVideo?: boolean;
  likes: number;
  likedBy?: string[];
  comments: number;
  shares: number;
  timestamp: number;
}

interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: number;
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80";

export function HomeTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ url: string, file: File } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [animatingLikes, setAnimatingLikes] = useState<Set<string>>(new Set());
  
  // Post Actions
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editPostText, setEditPostText] = useState('');
  const [editSelectedImage, setEditSelectedImage] = useState<{ url: string, file: File | null } | null>(null);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Comments
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);

  // Share Modal State
  const [sharingPost, setSharingPost] = useState<Post | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [shareSearchQuery, setShareSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(msgs);
    }, (error) => {
      console.error("Error fetching posts: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Fetch users for share modal
  useEffect(() => {
    if (sharingPost && availableUsers.length === 0) {
      const fetchUsers = async () => {
        try {
          const q = query(collection(db, 'users'), limit(50));
          const snapshot = await getDocs(q);
          const fetchedUsers = snapshot.docs
            .map(d => {
              const data = d.data();
              return {
                id: d.id,
                displayName: data.displayName,
                name: data.name,
                photoURL: data.photoURL,
                avatar: data.avatar
              };
            })
            .filter((u) => u.id !== auth.currentUser?.uid);
          
          setAvailableUsers(fetchedUsers.map(u => ({
            id: u.id,
            username: `@${u.id.substring(0, 8)}`,
            name: u.displayName || u.name || 'User',
            avatar: u.photoURL || u.avatar || DEFAULT_AVATAR
          })));
        } catch (err) {
          console.error("Error fetching users for share:", err);
        }
      };
      fetchUsers();
    }
  }, [sharingPost]);

  // Handle back button for the modal
  useEffect(() => {
    const handlePopState = () => {
      if (sharingPost) {
        setSharingPost(null);
        setSelectedFriends([]);
        setShareSearchQuery('');
        setShareCaption('');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [sharingPost]);

  const openShareModal = (post: Post) => {
    setSharingPost(post);
    window.history.pushState({ modal: 'share' }, '');
  };

  const closeShareModal = () => {
    if (window.history.state?.modal === 'share') {
      window.history.back(); // This will trigger popstate
    } else {
      setSharingPost(null);
      setSelectedFriends([]);
      setShareSearchQuery('');
      setShareCaption('');
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSelectedImage({ url, file });
    }
  };

  useEffect(() => {
    return () => {
      if (selectedImage?.url && selectedImage.url.startsWith('blob:')) {
        URL.revokeObjectURL(selectedImage.url);
      }
    };
  }, [selectedImage?.url]);

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setEditSelectedImage({ url, file });
    }
  };

  useEffect(() => {
    return () => {
      if (editSelectedImage?.url && editSelectedImage.url.startsWith('blob:')) {
        URL.revokeObjectURL(editSelectedImage.url);
      }
    };
  }, [editSelectedImage?.url]);

  const handleCreatePost = async () => {
    if ((!newPostText.trim() && !selectedImage) || !auth.currentUser || uploading) return;
    setUploading(true);
    let imageUrl = null;

    try {
      if (selectedImage) {
        const { url } = await uploadMedia(selectedImage.file, auth.currentUser.uid, 'post');
        imageUrl = url;
      }

      const newPostData = {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || (auth.currentUser.isAnonymous ? 'Guest User' : 'User'),
        authorAvatar: auth.currentUser.photoURL || DEFAULT_AVATAR,
        author: {
          id: auth.currentUser.uid,
          name: auth.currentUser.displayName || (auth.currentUser.isAnonymous ? 'Guest User' : 'User'),
          username: `@${auth.currentUser.uid.substring(0, 8)}`,
          avatar: auth.currentUser.photoURL || DEFAULT_AVATAR
        },
        content: newPostText,
        image: imageUrl || null,
        likes: 0,
        comments: 0,
        shares: 0,
        timestamp: Date.now()
      };

      await addDoc(collection(db, 'posts'), newPostData);
      setNewPostText('');
      setSelectedImage(null);
    } catch (error) {
      console.error("Error creating post", error);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleLike = async (post: Post) => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const isLiked = post.likedBy?.includes(uid);
    const newLikedBy = isLiked 
      ? (post.likedBy || []).filter(id => id !== uid)
      : [...(post.likedBy || []), uid];
      
    // Increment/decrement likes locally for visual feedback immediately
    setAnimatingLikes(prev => new Set(prev).add(post.id));
    setTimeout(() => {
      setAnimatingLikes(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }, 300);

    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        likes: increment(isLiked ? -1 : 1),
        likedBy: isLiked ? arrayRemove(uid) : arrayUnion(uid)
      });

      // Send notification if it's a new like and not liking own post
      const targetUserId = post.authorId || post.author?.id;
      if (!isLiked && auth.currentUser.uid !== targetUserId) {
        await addDoc(collection(db, 'notifications'), {
          to: targetUserId,
          from: auth.currentUser.uid,
          fromName: auth.currentUser.displayName || 'User',
          fromAvatar: auth.currentUser.photoURL || DEFAULT_AVATAR,
          type: 'like',
          postId: post.id,
          status: 'unread',
          timestamp: Date.now()
        });
      }
    } catch (e) {
      console.error("Error updating likes", e);
      alert('Something went wrong while updating likes. Please try again.');
    }
  };

  const handleEditPostSubmit = async () => {
    if (!editingPost || (!editPostText.trim() && !editSelectedImage) || uploading) return;
    setUploading(true);
    let imageUrl = editSelectedImage?.url || null;

    try {
      if (editSelectedImage?.file) {
        const { url } = await uploadMedia(editSelectedImage.file, auth.currentUser.uid, 'post');
        imageUrl = url;
      }

      const postRef = doc(db, 'posts', editingPost.id);
      await updateDoc(postRef, {
        content: editPostText,
        image: imageUrl || null
      });

      setEditingPost(null);
      setEditPostText('');
      setEditSelectedImage(null);
    } catch (e) {
      console.error("Error editing post", e);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!deletingPost) return;
    try {
      await deleteDoc(doc(db, 'posts', deletingPost.id));
      setDeletingPost(null);
    } catch (e) {
      console.error("Error deleting post", e);
    }
  };

  const loadComments = (postId: string) => {
    if (commentsPostId === postId) {
      setCommentsPostId(null);
      return;
    }
    setCommentsPostId(postId);
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
    onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          content: data.content,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar,
          timestamp: data.timestamp
        } as Comment;
      }));
    });
  };

  const handleCreateComment = async (postId: string) => {
    if (!newCommentText.trim() || !auth.currentUser || commenting) return;
    setCommenting(true);
    try {
      const commentData = {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'User',
        authorAvatar: auth.currentUser.photoURL || DEFAULT_AVATAR,
        content: newCommentText,
        timestamp: Date.now()
      };
      await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
      
      try {
        const postRef = doc(db, 'posts', postId);
        const post = posts.find(p => p.id === postId);
        if (post) {
          await updateDoc(postRef, { comments: (post.comments || 0) + 1 });
          
          const targetUserId = post.authorId || post.author?.id;
          if (auth.currentUser.uid !== targetUserId) {
            await addDoc(collection(db, 'notifications'), {
              to: targetUserId,
              from: auth.currentUser.uid,
              fromName: auth.currentUser.displayName || 'User',
              fromAvatar: auth.currentUser.photoURL || DEFAULT_AVATAR,
              type: 'comment',
              postId: post.id,
              status: 'unread',
              timestamp: Date.now()
            });
          }
        }
      } catch (updateErr) {
        console.error('Error updating post comment count:', updateErr);
      }
      setNewCommentText('');
    } catch (err: any) {
      console.error('Error adding comment', err);
      alert(`Error adding comment: ${err.message || err}`);
    } finally {
      setCommenting(false);
    }
  };

  const handleShareSubmit = async () => {
    if (!sharingPost || selectedFriends.length === 0 || !auth.currentUser) return;
    
    setUploading(true);
    try {
      // 1. Increase shares count in Firestore
      const postRef = doc(db, 'posts', sharingPost.id);
      await updateDoc(postRef, {
        shares: increment(1)
      });

      // 2. Send the post to each selected friend's DM
      const currentUserId = auth.currentUser.uid;
      const sharePromises = selectedFriends.map(async (friendId) => {
        const chatId = [currentUserId, friendId].sort().join('_');
        const chatRef = doc(db, 'dms', chatId);
        
        // Ensure chat doc exists
        const chatSnap = await getDoc(chatRef);
        if (!chatSnap.exists()) {
          await setDoc(chatRef, {
            participants: [currentUserId, friendId],
            createdAt: Date.now()
          });
        }

        // Add message with post info
        await addDoc(collection(db, `dms/${chatId}/messages`), {
          text: shareCaption || "Check out this post!",
          senderId: currentUserId,
          timestamp: Date.now(),
          sharedPostId: sharingPost.id
        });
      });

      await Promise.all(sharePromises);
      alert(`Shared with ${selectedFriends.length} friends!`);
    } catch (e) {
      console.error("Error sharing post", e);
      alert("Failed to share post. Please try again.");
    } finally {
      setUploading(false);
      closeShareModal();
    }
  };

  const copyPostLink = (postId: string) => {
    const url = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(url);
    setActiveMenuPostId(null);
    alert('Link copied to clipboard!');
  };

  const currentUserName = auth.currentUser?.displayName || (auth.currentUser?.isAnonymous ? 'Guest' : 'User');

  return (
    <div className="animate-slide-up pb-10">

      {/* Create Post UI */}
      <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60 mb-6 md:max-w-2xl md:mx-auto">
        <div className="flex gap-3 mb-4">
          <img src={auth.currentUser?.photoURL || DEFAULT_AVATAR} alt="Your Avatar" className="w-[42px] h-[42px] object-cover rounded-full shadow-sm" />
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="What's happening?"
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none pt-2 text-[15px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            rows={2}
          />
        </div>

        {selectedImage && (
          <div className="relative mb-4 rounded-[20px] overflow-hidden bg-slate-100 max-w-fit">
            <img src={selectedImage.url} alt="Selected" className="max-h-[200px] object-contain" />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1 text-slate-500">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageChange}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => alert('Video posting coming soon!')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <Video className="w-5 h-5" />
            </button>
            <button 
              onClick={() => alert('Location tagging coming soon!')}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={handleCreatePost}
            disabled={(!newPostText.trim() && !selectedImage) || uploading}
            className={`px-5 py-2 font-bold text-[14px] rounded-full transition-all ${((!newPostText.trim() && !selectedImage) || uploading) ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white shadow-md hover:bg-slate-800'}`}
          >
            {uploading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      <div className="space-y-5 md:max-w-2xl md:mx-auto">
        {posts.length === 0 ? (
          <div className="text-center py-10 text-slate-400 font-medium bg-white/50 rounded-3xl border border-white/60 shadow-sm">No posts yet. Be the first to post!</div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="bg-white/80 backdrop-blur-xl rounded-[32px] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <img src={post.author?.avatar || DEFAULT_AVATAR} alt={post.author?.name} className="w-[42px] h-[42px] object-cover rounded-full shadow-sm cursor-pointer" />
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-900 leading-tight flex items-center gap-2">
                       {post.authorName || post.author?.name || post.author?.username || '@user'}
                    </h3>
                    <p className="text-[12px] text-slate-500 font-medium">{formatTime(post.timestamp)}</p>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id)}
                    className={`text-slate-400 hover:text-slate-600 p-2 rounded-full transition-colors ${activeMenuPostId === post.id ? 'bg-slate-100' : 'hover:bg-slate-100'}`}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                  
                  {activeMenuPostId === post.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-[60]" 
                        onClick={() => setActiveMenuPostId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/50 p-1.5 z-[70] animate-fade-in ring-1 ring-black/5">
                        {(post.authorId === auth.currentUser?.uid || post.author?.id === auth.currentUser?.uid) ? (
                          <>
                            <button 
                              onClick={() => {
                                setEditingPost(post);
                                setEditPostText(post.content || '');
                                if (post.image) {
                                  setEditSelectedImage({ url: post.image, file: null });
                                } else {
                                  setEditSelectedImage(null);
                                }
                                setActiveMenuPostId(null);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-emerald-500" /> Edit Post
                            </button>
                            <button 
                              onClick={() => {
                                setDeletingPost(post);
                                setActiveMenuPostId(null);
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Delete Post
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => copyPostLink(post.id)}
                              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <LinkIcon className="w-4 h-4" /> Copy Link
                            </button>
                            <button 
                              onClick={() => {
                                setActiveMenuPostId(null);
                                alert('Thank you for reporting. Our team will review this post.');
                              }}
                              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-3 transition-colors"
                            >
                              <Flag className="w-4 h-4" /> Report Post
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {post.content && (
                <p className="text-[14px] text-slate-800 font-semibold mb-3 px-1 whitespace-pre-wrap">{post.content}</p>
              )}

              {post.image && (
                <div className="rounded-[24px] overflow-hidden mb-4 relative cursor-pointer group bg-slate-100">
                  <img src={post.image} alt="Post media" className="w-full h-[180px] object-cover hover:scale-105 transition-transform duration-700" />
                  {post.isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors duration-300">
                       <div className="w-14 h-14 bg-slate-900/80 backdrop-blur-md rounded-full flex items-center justify-center text-white shadow-xl scale-95 group-hover:scale-100 transition-transform">
                          <Play className="w-6 h-6 fill-white ml-1" />
                       </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-5 text-[14px] font-bold text-slate-700 mb-2 px-2">
                <div 
                  className="flex items-center gap-1.5 cursor-pointer selection:bg-transparent transition-opacity hover:opacity-80"
                  onClick={() => handleToggleLike(post)}
                >
                  <Heart className={`w-4 h-4 transition-colors ${post.likedBy?.includes(auth.currentUser?.uid || '') ? 'text-rose-500 fill-rose-500' : 'text-slate-500'} ${animatingLikes.has(post.id) ? 'animate-pop text-rose-500 fill-rose-500' : ''}`} /> 
                  <span className={post.likedBy?.includes(auth.currentUser?.uid || '') ? 'text-rose-600' : 'text-slate-600'}>{post.likes || 0}</span>
                </div>
                <div 
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => loadComments(post.id)}
                >
                  <MessageCircle className="w-4 h-4 text-slate-500" /> 
                  <span className="text-slate-600">{post.comments || 0}</span>
                </div>
                <div 
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => openShareModal(post)}
                >
                  <Send className="w-4 h-4 text-slate-500" /> <span className="text-slate-600">{post.shares || 0}</span>
                </div>
              </div>

              {/* Comments Section */}
              {commentsPostId === post.id && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-slide-up">
                  <div className="space-y-4 mb-4">
                    {comments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-3">
                        <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover" />
                        <div className="flex-1 bg-slate-50 rounded-2xl rounded-tl-none p-3 pb-4 relative">
                          <p className="text-[13px] font-bold text-slate-900">{comment.authorName}</p>
                          <p className="text-[14px] text-slate-700 mt-0.5">{comment.content}</p>
                          <span className="absolute bottom-2 right-3 text-[10px] text-slate-400">{formatTime(comment.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-[13px] text-slate-500 text-center py-2">No comments yet. Start the conversation!</p>}
                  </div>
                  
                  <div className="flex gap-3 items-center">
                     <img src={auth.currentUser?.photoURL || DEFAULT_AVATAR} alt="You" className="w-8 h-8 rounded-full object-cover" />
                     <div className="flex-1 relative">
                       <input 
                         type="text" 
                         value={newCommentText}
                         onChange={(e) => setNewCommentText(e.target.value)}
                         placeholder="Write a comment..." 
                         className="w-full bg-slate-100/80 rounded-full py-2.5 pl-4 pr-12 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#1da06d]/20 transition-all font-medium text-slate-800"
                         onKeyDown={(e) => e.key === 'Enter' && handleCreateComment(post.id)}
                       />
                       <button 
                         onClick={() => handleCreateComment(post.id)}
                         disabled={commenting || !newCommentText.trim()}
                         className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#1da06d] text-white rounded-full flex items-center justify-center disabled:bg-slate-300 disabled:text-slate-500 transition-colors hover:bg-[#168a5c]"
                       >
                         <Send className="w-4 h-4" />
                       </button>
                     </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Edit Post Modal */}
      {editingPost && createPortal(
        <div 
          className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in"
          onClick={() => { setEditingPost(null); setEditSelectedImage(null); }}
        >
           <div 
             className="bg-white w-full max-w-lg rounded-[32px] p-6 shadow-2xl relative"
             onClick={(e) => e.stopPropagation()}
           >
              <button onClick={() => { setEditingPost(null); setEditSelectedImage(null); }} className="absolute right-4 top-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 mb-4 px-2">Edit Post</h3>
              <textarea
                value={editPostText}
                onChange={(e) => setEditPostText(e.target.value)}
                className="w-full bg-slate-50 rounded-2xl p-4 text-[15px] font-medium text-slate-800 border-none focus:ring-2 focus:ring-emerald-500/20 resize-none min-h-[120px]"
                placeholder="What's on your mind?"
              />
              
              {editSelectedImage && (
                <div className="relative mt-4 rounded-xl overflow-hidden bg-slate-100 mx-2">
                  <img src={editSelectedImage.url} alt="To upload" className="max-h-[200px] w-full object-contain" />
                  <button onClick={() => setEditSelectedImage(null)} className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              <div className="flex items-center justify-between mt-4 px-2">
                 <input type="file" accept="image/*" className="hidden" ref={editFileInputRef} onChange={handleEditImageChange} />
                 <button onClick={() => editFileInputRef.current?.click()} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-full font-bold text-[14px] flex items-center gap-2 transition-colors">
                    <ImageIcon className="w-4 h-4" /> Change Image
                 </button>
                 <button onClick={handleEditPostSubmit} disabled={uploading || (!editPostText.trim() && !editSelectedImage)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-full font-bold text-[14px] disabled:bg-slate-300 disabled:text-slate-500 transition-colors shadow-md">
                    {uploading ? 'Saving...' : 'Save'}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deletingPost && createPortal(
         <div 
           className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 animate-fade-in"
           onClick={() => setDeletingPost(null)}
         >
            <div 
              className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
               <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Post?</h3>
               <p className="text-slate-500 font-medium text-[14px] mb-6">This action cannot be undone. Are you sure you want to permanently delete this post?</p>
               <div className="flex gap-3">
                 <button onClick={() => setDeletingPost(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition-colors">Cancel</button>
                 <button onClick={handleDeletePost} className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl shadow-md flex justify-center items-center gap-2 transition-colors">Delete</button>
               </div>
            </div>
         </div>,
         document.body
      )}

      {/* Share Modal */}
      {sharingPost && createPortal(
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in pointer-events-auto">
          <div className="app-bg-secondary w-full max-w-[420px] rounded-t-[32px] sm:rounded-[32px] p-5 pt-3 shadow-2xl animate-slide-up border border-white/60 relative flex flex-col h-[80vh] sm:h-[600px] max-h-[800px]">
            {/* Header / Handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="relative flex justify-center items-center mb-4 shrink-0">
              <h3 className="text-[17px] font-bold text-slate-900 mt-1">Share</h3>
              <button 
                onClick={closeShareModal}
                className="absolute right-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                value={shareSearchQuery}
                onChange={e => setShareSearchQuery(e.target.value)}
                placeholder="Search" 
                className="w-full bg-slate-100/80 border border-slate-200/60 rounded-[14px] py-2.5 pl-10 pr-4 text-[14px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto mb-2 -mx-2 px-2 hide-scrollbar">
              {availableUsers.length === 0 ? (
                <div className="text-center p-4 text-slate-400 font-medium">No other users found.</div>
              ) : (
                availableUsers.filter(f => {
                  const query = shareSearchQuery.toLowerCase();
                  return (f.username?.toLowerCase() || '').includes(query) || 
                         (f.name?.toLowerCase() || '').includes(query);
                }).map(friend => (
                  <div 
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className="flex items-center justify-between p-2.5 rounded-[20px] hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <img src={friend.avatar} alt={friend.name} className="w-[46px] h-[46px] rounded-full object-cover shadow-sm border border-slate-200/50 bg-slate-100" />
                      <div>
                        <p className="text-[14.5px] font-bold text-slate-900 leading-none mb-1">{friend.name}</p>
                        <p className="text-[12px] font-medium text-slate-500">{friend.username}</p>
                      </div>
                    </div>
                    <div>
                      {selectedFriends.includes(friend.id) ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-100" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action Area */}
            <div className="shrink-0 pt-3 border-t border-slate-200/80 mt-auto">
              {selectedFriends.length > 0 && (
                <div className="animate-slide-up mb-3">
                   <input 
                      type="text"
                      value={shareCaption}
                      onChange={e => setShareCaption(e.target.value)}
                      placeholder="Write a message..."
                      className="w-full bg-white border border-slate-200 rounded-[16px] py-3.5 px-4 text-[14.5px] font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm"
                   />
                </div>
              )}
              <button 
                onClick={handleShareSubmit}
                disabled={selectedFriends.length === 0}
                className="w-full bg-[#1da06d] text-white font-bold py-3.5 rounded-[16px] shadow-md hover:bg-[#168a5c] transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none text-[15px]"
              >
                {selectedFriends.length > 0 ? `Send to ${selectedFriends.length} ${selectedFriends.length === 1 ? 'chat' : 'chats'}` : 'Send'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
