
import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeftIcon, ChatBubbleOvalLeftIcon } from '../components/icons';

interface FollowingScreenProps {
    userId: string;
    onBack: () => void;
    onViewProfile: (user: UserProfile) => void;
    onStartChat: (recipient: UserProfile) => void;
}

const FollowingScreen: React.FC<FollowingScreenProps> = ({ userId, onBack, onViewProfile, onStartChat }) => {
    const [following, setFollowing] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFollowing = async () => {
             if (!userId) return;
             setLoading(true);
             try {
                 // 1. Get the user document to find out who they are following
                 const userDocRef = doc(db, 'users', userId);
                 const userSnap = await getDoc(userDocRef);
                 if (userSnap.exists()) {
                     const userData = userSnap.data() as UserProfile;
                     const followingIds = userData.following || [];
                     
                     if (followingIds.length === 0) {
                         setFollowing([]);
                         setLoading(false);
                         return;
                     }

                     // 2. Fetch profiles for the following IDs in chunks (Firestore 'in' limit is 30)
                     const chunks = [];
                     const chunkSize = 30;
                     for (let i = 0; i < followingIds.length; i += chunkSize) {
                         chunks.push(followingIds.slice(i, i + chunkSize));
                     }

                     const fetchedProfiles: UserProfile[] = [];
                     for (const chunk of chunks) {
                         if (chunk.length > 0) {
                            const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
                            const querySnapshot = await getDocs(q);
                            querySnapshot.forEach(doc => {
                                fetchedProfiles.push({ uid: doc.id, ...doc.data() } as UserProfile);
                            });
                         }
                     }
                     setFollowing(fetchedProfiles);
                 } else {
                     setFollowing([]);
                 }
             } catch (error) {
                 console.error("Error fetching following list:", error);
             } finally {
                 setLoading(false);
             }
        };
        fetchFollowing();
    }, [userId]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Following</h1>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full p-8">
                        <LoadingSpinner />
                    </div>
                ) : following.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="font-semibold text-lg">Not Following Anyone</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Profiles followed will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {following.map(user => (
                            <div key={user.uid} className="p-4 flex items-center space-x-4">
                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    className="w-12 h-12 rounded-full cursor-pointer"
                                    onClick={() => onViewProfile(user)}
                                />
                                <div className="flex-grow cursor-pointer" onClick={() => onViewProfile(user)}>
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                        {user.role}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onStartChat(user)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    aria-label={`Message ${user.name}`}
                                >
                                    <ChatBubbleOvalLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default FollowingScreen;
