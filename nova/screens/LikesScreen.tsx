
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Post, UserProfile } from '../types';
import PostCard from '../components/PostCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsersForItems } from '../utils/firebaseUtils';

// Helper to fetch documents in chunks for Firestore 'in' query
const fetchDocsInChunks = async <T,>(collectionName: string, ids: string[]): Promise<T[]> => {
    if (ids.length === 0) return [];
    const results: T[] = [];
    const chunkSize = 30;
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const q = query(collection(db, collectionName), where(documentId(), 'in', chunk));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data() } as T);
        });
    }
    return results;
};

interface LikesScreenProps {
    onViewProfile: (user: UserProfile) => void;
    onStartChat: (recipient: UserProfile) => void;
}

const LikesScreen: React.FC<LikesScreenProps> = ({ onViewProfile, onStartChat }) => {
    const { userProfile } = useAuth();
    const [likedPosts, setLikedPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLikedPosts = async () => {
            if (!userProfile?.likedPosts || userProfile.likedPosts.length === 0) {
                setLikedPosts([]);
                setLoading(false);
                return;
            }
            
            setLoading(true);
            try {
                const posts = await fetchDocsInChunks<Post>('posts', userProfile.likedPosts);
                const postsWithUsers = await fetchUsersForItems(posts, 'userId', 'user');
                
                // Sort by creation date, most recent first
                postsWithUsers.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setLikedPosts(postsWithUsers as Post[]);
            } catch (error) {
                console.error("Error fetching liked posts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLikedPosts();
    }, [userProfile]);

    return (
        <div className="w-full h-full">
            <header className="sticky top-0 bg-white dark:bg-black bg-opacity-95 backdrop-blur-sm z-10 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h1 className="text-xl font-bold">Likes</h1>
            </header>
            
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <LoadingSpinner />
                </div>
            ) : likedPosts.length > 0 ? (
                <div className="space-y-0">
                    {likedPosts.map(post => (
                        <PostCard 
                            key={post.id} 
                            post={post} 
                            onStartChat={onStartChat}
                            onViewProfile={onViewProfile} 
                        />
                    ))}
                </div>
            ) : (
                 <div className="text-center py-16 px-4">
                    <h2 className="font-semibold text-lg">No Liked Posts</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Posts you like will appear here.</p>
                </div>
            )}
        </div>
    );
};

export default LikesScreen;