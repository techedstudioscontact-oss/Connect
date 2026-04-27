import React, { useState, useEffect, useRef } from 'react';
import { Post, UserProfile, NotificationType, Comment } from '../types';
import { HeartIcon, ChatBubbleOvalLeftIcon, BookmarkIcon, EllipsisHorizontalIcon, PaperAirplaneIcon, BookmarkIconFilled, HeartIconFilled, CheckBadgeIcon } from './icons';
import { useAuth } from '../App';
import { doc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { fetchUsersForItems } from '../utils/firebaseUtils';
import { LoadingSpinner } from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

interface PostCardProps {
    post: Post;
    onStartChat: (recipient: UserProfile) => void;
    onViewProfile: (user: UserProfile) => void;
}

const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)}y`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)}mo`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)}d`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)}h`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)}m`;
    return `${Math.floor(seconds)}s`;
};

const PostCard: React.FC<PostCardProps> = ({ post, onStartChat, onViewProfile }) => {
    const { user, userProfile } = useAuth();
    // FIX: Add default empty array to prevent crash if post.likes is undefined
    const isLiked = user ? (post.likes || []).includes(user.uid) : false;
    const isSaved = userProfile?.savedPosts?.includes(post.id) ?? false;

    const [showComments, setShowComments] = useState(false);
    const [commentsWithProfiles, setCommentsWithProfiles] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);


    useEffect(() => {
        const fetchCommentUsers = async () => {
            if (!showComments || !post.comments || post.comments.length === 0) {
                setCommentsWithProfiles([]);
                return;
            }
            setLoadingComments(true);
            // Ensure comments are sorted by time before fetching users
            const sortedComments = [...post.comments].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
            const enrichedComments = await fetchUsersForItems(sortedComments, 'userId', 'user');
            setCommentsWithProfiles(enrichedComments as Comment[]);
            setLoadingComments(false);
        };

        fetchCommentUsers();
    }, [showComments, post.comments]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLike = async () => {
        if (!user || !userProfile) return;
        const postRef = doc(db, 'posts', post.id);
        if (isLiked) {
            await updateDoc(postRef, { likes: arrayRemove(user.uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(user.uid) });
            if (user.uid !== post.userId) {
                await addDoc(collection(db, 'notifications'), {
                    recipientId: post.userId,
                    senderId: user.uid,
                    type: NotificationType.LIKE,
                    entityId: post.id,
                    message: `liked your post.`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }
        }
    };

    const handleSave = async () => {
        if (!user || !userProfile) return;
        const userRef = doc(db, 'users', user.uid);
        if (isSaved) {
            await updateDoc(userRef, { savedPosts: arrayRemove(post.id) });
        } else {
            await updateDoc(userRef, { savedPosts: arrayUnion(post.id) });
        }
    };

    const handleShare = () => {
        setIsMenuOpen(false);
        // Create a consistent, albeit non-routable, URL for the post.
        const postUrl = `${window.location.origin}/post/${post.id}`;
        
        if (navigator.share) {
            navigator.share({
                title: 'Check out this post on CollabSea!',
                text: post.caption,
                url: postUrl, // Use the post-specific URL.
            }).catch((error) => console.error('Error sharing:', error));
        } else {
            // Fallback for browsers that don't support the Web Share API
            navigator.clipboard.writeText(postUrl)
                .then(() => alert('Link copied to clipboard!'))
                .catch(err => {
                    console.error('Failed to copy post link: ', err);
                    // Provide more helpful feedback to the user
                    alert('Failed to copy link. This feature may require a secure connection (HTTPS).');
                });
        }
    };

    const handleDelete = async () => {
        setIsMenuOpen(false);
        if (user?.uid !== post.userId) {
            console.warn("Delete prevented: user is not the post owner.");
            return;
        }

        if (!post.id) {
            console.error("Delete failed: post ID is missing.");
            alert("Could not delete post: Post ID is invalid.");
            return;
        }

        if (window.confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            try {
                // Deleting from Cloudinary requires a backend function to securely handle the API secret.
                // We first get the post document to retrieve the media's public_id.
                const postDoc = await getDoc(doc(db, 'posts', post.id));
                if (postDoc.exists()) {
                    const postData = postDoc.data() as Post;
                    if (postData.mediaPublicId) {
                        // In a real application, you would call a cloud function here to delete the media from Cloudinary.
                        // e.g., `await functions.httpsCallable('deleteCloudinaryMedia')({ publicId: postData.mediaPublicId });`
                        console.log(`Cloudinary deletion would be triggered for public_id: ${postData.mediaPublicId}`);
                    }
                }

                // Delete the post document from Firestore.
                await deleteDoc(doc(db, 'posts', post.id));
            } catch (error) {
                console.error("Error deleting post:", error);
                alert("Failed to delete the post. Please try again.");
            }
        }
    };
    
    const handleCommentIconClick = () => {
        setShowComments(true);
        setTimeout(() => commentInputRef.current?.focus(), 100);
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !userProfile || !newComment.trim()) return;
        
        setIsSubmittingComment(true);

        const commentToAdd: Comment = {
            userId: user.uid,
            username: userProfile.name,
            comment: newComment.trim(),
            createdAt: Timestamp.now(),
        };

        const postRef = doc(db, 'posts', post.id);

        try {
            await updateDoc(postRef, {
                comments: arrayUnion(commentToAdd)
            });

            if (user.uid !== post.userId) {
                await addDoc(collection(db, 'notifications'), {
                    recipientId: post.userId,
                    senderId: user.uid,
                    type: NotificationType.COMMENT,
                    entityId: post.id,
                    message: `commented: ${commentToAdd.comment}`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            setNewComment('');
        } catch (error) {
            console.error("Error adding comment: ", error);
        } finally {
            setIsSubmittingComment(false);
        }
    };
    
    // FIX: Add default empty arrays to prevent crash if fields are missing
    const likesCount = (post.likes || []).length;
    const commentsCount = (post.comments || []).length;

    return (
        <div className="bg-white dark:bg-black">
            <div className="p-3 flex justify-between items-center">
                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => post.user && onViewProfile(post.user)}>
                    <img loading="lazy" src={post.user?.avatar || `https://i.pravatar.cc/150?u=${post.userId}`} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
                    <div>
                        <div className="flex items-center gap-1">
                            <p className="font-semibold text-sm">{post.user?.name || 'User'}</p>
                            {post.user?.isVerified && <CheckBadgeIcon className="h-3 w-3 text-blue-500" />}
                        </div>
                    </div>
                </div>
                 <div className="relative">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="More options" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><EllipsisHorizontalIcon className="h-6 w-6 text-gray-500" /></button>
                     <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 origin-top-right"
                            >
                                <ul className="p-1">
                                    <li><button onClick={handleShare} className="w-full text-left rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Share</button></li>
                                    {user?.uid === post.userId && (
                                        <li><button onClick={handleDelete} className="w-full text-left rounded-md px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700">Delete</button></li>
                                    )}
                                </ul>
                            </motion.div>
                        )}
                    </AnimatePresence>
                 </div>
            </div>
            <div className="w-full aspect-square bg-gray-100 dark:bg-gray-900">
                {post.mediaType === 'video' ? (
                    <video src={post.mediaUrl} controls className="w-full h-full object-contain" />
                ) : (
                    <img loading="lazy" src={post.mediaUrl} alt="post content" className="w-full h-full object-cover" />
                )}
            </div>
            <div className="p-3">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex space-x-4">
                        <button onClick={handleLike} aria-label={isLiked ? 'Unlike' : 'Like'}>
                            {isLiked ? <HeartIconFilled className="h-7 w-7 text-red-500" /> : <HeartIcon className="h-7 w-7 text-gray-800 dark:text-gray-100" />}
                        </button>
                        <button onClick={handleCommentIconClick} aria-label="Comment"><ChatBubbleOvalLeftIcon className="h-7 w-7 text-gray-800 dark:text-gray-100" /></button>
                        <button onClick={handleShare} aria-label="Share post">
                            <PaperAirplaneIcon className="h-7 w-7 text-gray-800 dark:text-gray-100" />
                        </button>
                    </div>
                    <button onClick={handleSave} aria-label={isSaved ? 'Unsave post' : 'Save post'}>
                        {isSaved ? <BookmarkIconFilled className="h-7 w-7 text-gray-800 dark:text-gray-100" /> : <BookmarkIcon className="h-7 w-7 text-gray-800 dark:text-gray-100" />}
                    </button>
                </div>
                <p className="font-semibold text-sm">{likesCount} likes</p>
                <p className="text-sm my-1">
                    <span className="font-semibold cursor-pointer" onClick={() => post.user && onViewProfile(post.user)}>{post.user?.name || 'User'}</span> <span className="text-gray-800 dark:text-gray-200">{post.caption}</span>
                </p>
                {commentsCount > 0 && (
                    <p onClick={() => setShowComments(!showComments)} className="text-sm text-gray-500 mt-1 cursor-pointer">
                        {showComments ? 'Hide comments' : `View all ${commentsCount} comments`}
                    </p>
                )}
                {showComments && (
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-2">
                        {loadingComments ? <div className="flex justify-center py-2"><LoadingSpinner /></div> : (
                            commentsWithProfiles
                                .map((comment) => (
                                    <div key={`${comment.createdAt.toMillis()}-${comment.userId}`} className="text-sm flex items-start space-x-2">
                                        <img loading="lazy" src={comment.user?.avatar || `https://i.pravatar.cc/150?u=${comment.userId}`} alt={comment.user?.name} className="w-6 h-6 rounded-full mt-0.5" />
                                        <div className="flex-grow">
                                            <p><span className="font-semibold mr-1 cursor-pointer" onClick={() => comment.user && onViewProfile(comment.user)}>{comment.user?.name || comment.username}</span>
                                            <span>{comment.comment}</span></p>
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                )}
                 
                 <form onSubmit={handleCommentSubmit} className="mt-2 flex items-center space-x-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                    <img src={userProfile?.avatar} alt="your avatar" className="w-7 h-7 rounded-full" />
                    <input 
                        ref={commentInputRef}
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-grow bg-transparent text-sm focus:outline-none placeholder-gray-500 text-gray-900 dark:text-gray-100"
                    />
                    <button type="submit" disabled={!newComment.trim() || isSubmittingComment} className="text-sky-500 font-semibold text-sm disabled:opacity-50 disabled:text-sky-300">
                        {isSubmittingComment ? '...' : 'Post'}
                    </button>
                </form>
                <p className="text-xs text-gray-400 mt-2 uppercase">{post.createdAt ? timeAgo(post.createdAt.toDate()) : ''}</p>
            </div>
        </div>
    );
};

export default PostCard;