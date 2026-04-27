

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Conversation, UserProfile } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsersForItems } from '../utils/firebaseUtils';

interface MessagesScreenProps {
    onNavigateToChat: (conversationId: string, recipient: UserProfile) => void;
}

const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m";
    return Math.floor(seconds) + "s";
}

const MessagesScreen: React.FC<MessagesScreenProps> = ({ onNavigateToChat }) => {
    const { userProfile } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;

        setLoading(true);
        const convosQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userProfile.uid)
        );

        const unsubscribe = onSnapshot(convosQuery, async (snapshot) => {
            const convosData = snapshot.docs.map(d => {
                const convo = { id: d.id, ...d.data() } as Conversation;
                // Add a temporary recipientId property for the utility function to use
                const recipientId = convo.participants.find(p => p !== userProfile.uid);
                return { ...convo, recipientId };
            });

            // Sort conversations by last update timestamp client-side
            convosData.sort((a, b) => (b.lastUpdatedAt?.toMillis() || 0) - (a.lastUpdatedAt?.toMillis() || 0));

            const convosWithRecipients = await fetchUsersForItems(convosData, 'recipientId', 'recipientProfile');

            setConversations(convosWithRecipients.filter(c => c.recipientProfile) as unknown as Conversation[]);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching conversations:", error);
            setLoading(false);
        });

        return () => unsubscribe();

    }, [userProfile]);

    if (loading) {
        return (
            <div className="p-4 flex justify-center">
                <LoadingSpinner />
            </div>
        )
    }

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Messages</h1>
            <div className="space-y-3">
                {conversations.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center mt-8">No conversations yet.</p>
                ) : (
                    conversations.map(convo => (
                        <div key={convo.id} onClick={() => onNavigateToChat(convo.id, convo.recipientProfile!)} className="flex items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
                            <img src={convo.recipientProfile?.avatar} alt={convo.recipientProfile?.name} className="w-12 h-12 rounded-full mr-4" />
                            <div className="flex-grow">
                                <h3 className="font-semibold">{convo.recipientProfile?.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{convo.lastMessage}</p>
                            </div>
                             {convo.lastUpdatedAt && (
                                <p className="text-xs text-gray-400 self-start">{timeAgo(convo.lastUpdatedAt.toDate())}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MessagesScreen;
