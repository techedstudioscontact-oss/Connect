
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeftIcon, ChatBubbleOvalLeftIcon } from '../components/icons';

interface FollowersScreenProps {
    userId: string;
    onBack: () => void;
    onViewProfile: (user: UserProfile) => void;
    onStartChat: (recipient: UserProfile) => void;
}

const FollowersScreen: React.FC<FollowersScreenProps> = ({ userId, onBack, onViewProfile, onStartChat }) => {
    const [followers, setFollowers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFollowers = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Find all users who have the target user's UID in their 'following' array.
                const q = query(collection(db, 'users'), where('following', 'array-contains', userId));
                const querySnapshot = await getDocs(q);
                const followerProfiles = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
                setFollowers(followerProfiles);
            } catch (error) {
                console.error("Error fetching followers:", error);
                setFollowers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowers();
    }, [userId]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Followers</h1>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full p-8">
                        <LoadingSpinner />
                    </div>
                ) : followers.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="font-semibold text-lg">No Followers Yet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">When someone follows this user, they'll appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {followers.map(follower => (
                            <div key={follower.uid} className="p-4 flex items-center space-x-4">
                                <img
                                    src={follower.avatar}
                                    alt={follower.name}
                                    className="w-12 h-12 rounded-full cursor-pointer"
                                    onClick={() => onViewProfile(follower)}
                                />
                                <div className="flex-grow cursor-pointer" onClick={() => onViewProfile(follower)}>
                                    <p className="font-semibold text-gray-900 dark:text-gray-100">{follower.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                                        {follower.role}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onStartChat(follower)}
                                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    aria-label={`Message ${follower.name}`}
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

export default FollowersScreen;
