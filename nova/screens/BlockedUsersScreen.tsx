import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, arrayRemove, collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { UserProfile } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeftIcon } from '../components/icons';

interface BlockedUsersScreenProps {
    onBack: () => void;
}

const BlockedUsersScreen: React.FC<BlockedUsersScreenProps> = ({ onBack }) => {
    const { user, userProfile } = useAuth();
    const [blockedProfiles, setBlockedProfiles] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBlockedUsers = async () => {
             if (!userProfile?.blockedUsers || userProfile.blockedUsers.length === 0) {
                 setBlockedProfiles([]);
                 setLoading(false);
                 return;
             }

             setLoading(true);
             try {
                 const chunks = [];
                 const chunkSize = 30;
                 for (let i = 0; i < userProfile.blockedUsers.length; i += chunkSize) {
                     chunks.push(userProfile.blockedUsers.slice(i, i + chunkSize));
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
                 setBlockedProfiles(fetchedProfiles);
             } catch (error) {
                 console.error("Error fetching blocked users:", error);
             } finally {
                 setLoading(false);
             }
        };

        fetchBlockedUsers();
    }, [userProfile]);

    const handleUnblock = async (uidToUnblock: string) => {
        if (!user || !userProfile) return;
        if (window.confirm("Are you sure you want to unblock this user?")) {
            try {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, {
                    blockedUsers: arrayRemove(uidToUnblock)
                });
                setBlockedProfiles(prev => prev.filter(p => p.uid !== uidToUnblock));
            } catch (error) {
                console.error("Error unblocking user:", error);
                alert("Failed to unblock user.");
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Blocked Users</h1>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full p-8">
                        <LoadingSpinner />
                    </div>
                ) : blockedProfiles.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="font-semibold text-lg">No Blocked Users</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Users you block will appear here.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {blockedProfiles.map(blockedUser => (
                            <div key={blockedUser.uid} className="p-4 flex items-center justify-between space-x-4">
                                <div className="flex items-center space-x-3">
                                    <img
                                        src={blockedUser.avatar}
                                        alt={blockedUser.name}
                                        className="w-10 h-10 rounded-full grayscale opacity-70"
                                    />
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">{blockedUser.name}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUnblock(blockedUser.uid)}
                                    className="px-3 py-1.5 text-sm font-semibold border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Unblock
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default BlockedUsersScreen;