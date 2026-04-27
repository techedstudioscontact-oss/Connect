
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, writeBatch, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Notification, NotificationType, UserProfile, Conversation } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HeartIcon, ChatBubbleOvalLeftIcon, UserPlusIcon, MegaphoneIcon, SparklesIcon } from '../components/icons';
import { fetchUsersForItems } from '../utils/firebaseUtils';
import { motion } from 'framer-motion';

interface InboxScreenProps {
    onViewProfile: (user: UserProfile) => void;
    onNavigateToChat: (conversationId: string, recipient: UserProfile) => void;
    onNavigateToNova: () => void;
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
};

const NotificationItem: React.FC<{ notification: Notification, onViewProfile: (user: UserProfile) => void }> = ({ notification, onViewProfile }) => {
    const getIcon = () => {
        const iconContainerClass = "h-10 w-10 rounded-full flex items-center justify-center";
        const iconClass = "h-5 w-5 text-white";

        switch (notification.type) {
            case NotificationType.LIKE:
                return <div className={`${iconContainerClass} bg-red-500`}><HeartIcon className={iconClass} /></div>;
            case NotificationType.NEW_MESSAGE:
                return <div className={`${iconContainerClass} bg-blue-500`}><ChatBubbleOvalLeftIcon className={iconClass} /></div>;
            case NotificationType.NEW_FOLLOWER:
                return <div className={`${iconContainerClass} bg-green-500`}><UserPlusIcon className={iconClass} /></div>;
            case NotificationType.CAMPAIGN_UPDATE:
                 return <div className={`${iconContainerClass} bg-purple-500`}><MegaphoneIcon className={iconClass} /></div>;
            default:
                return <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full" />;
        }
    };

    if (!notification.senderProfile) return null;

    return (
        <div className="flex items-center p-3 space-x-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onViewProfile(notification.senderProfile!)}>
            <img src={notification.senderProfile?.avatar} alt={notification.senderProfile?.name} className="w-10 h-10 rounded-full" />
            <div className="flex-grow">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="font-semibold">{notification.senderProfile?.name}</span> {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{notification.createdAt ? timeAgo(notification.createdAt.toDate()) : ''}</p>
            </div>
             {getIcon()}
        </div>
    );
};

const ActivityContent: React.FC<{ onViewProfile: (user: UserProfile) => void }> = ({ onViewProfile }) => {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;

        setLoading(true);
        // FIX: Removed orderBy('createdAt', 'desc') to avoid "Index Required" error.
        // Sorting is handled client-side.
        const notifsQuery = query(
            collection(db, 'notifications'),
            where('recipientId', '==', userProfile.uid),
            limit(100)
        );

        const unsubscribe = onSnapshot(notifsQuery, async (snapshot) => {
            const notifsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
            const notifsWithSenders = await fetchUsersForItems<Notification>(notifsData, 'senderId', 'senderProfile');
            
            // Client-side sorting
            notifsWithSenders.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });

            setNotifications(notifsWithSenders);
            setLoading(false);
            
            const unreadNotifs = snapshot.docs.filter(d => !d.data().read);
            if(unreadNotifs.length > 0) {
                const batch = writeBatch(db);
                unreadNotifs.forEach(d => {
                    batch.update(d.ref, { read: true });
                });
                await batch.commit().catch(console.error);
            }
        }, err => {
            console.error("Error fetching notifications:", err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile]);

    if (loading) return <div className="flex justify-center mt-8"><LoadingSpinner /></div>;
    
    if (notifications.length === 0) return (
        <div className="text-center py-16 px-4">
            <h2 className="font-semibold text-lg">No Activity Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Your notifications will appear here.</p>
        </div>
    );

    return (
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {notifications.map(notif => <NotificationItem key={notif.id} notification={notif} onViewProfile={onViewProfile} />)}
        </div>
    );
};

const MessagesContent: React.FC<{ onNavigateToChat: (conversationId: string, recipient: UserProfile) => void, onNavigateToNova: () => void }> = ({ onNavigateToChat, onNavigateToNova }) => {
    const { userProfile } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const convosQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', userProfile.uid)
        );

        const unsubscribe = onSnapshot(convosQuery, async (snapshot) => {
            try {
                const convosData = snapshot.docs.map(d => {
                    const convo = { id: d.id, ...d.data() } as Conversation;
                    // userProfile is guaranteed to exist here due to the check at the start of the effect.
                    const recipientId = convo.participants.find(p => p !== userProfile.uid);
                    return { ...convo, recipientId };
                });
                
                // Sort conversations by last update timestamp client-side
                convosData.sort((a, b) => (b.lastUpdatedAt?.toMillis() || 0) - (a.lastUpdatedAt?.toMillis() || 0));

                // fetchUsersForItems adds the 'recipientProfile' property to each object.
                const convosWithRecipients = await fetchUsersForItems(convosData, 'recipientId', 'recipientProfile');

                // The result needs a clear type assertion to safely filter.
                // We also filter out any conversations where the recipient couldn't be fetched.
                setConversations(
                    (convosWithRecipients as unknown as Array<Conversation & { recipientProfile?: UserProfile }>)
                        .filter((c): c is Conversation & { recipientProfile: UserProfile } => !!c.recipientProfile)
                );
            } catch (error) {
                console.error("Error processing conversations:", error);
            } finally {
                setLoading(false);
            }
        }, (error) => {
            console.error("Error fetching conversations:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile]);

    if (loading) return <div className="p-4 flex justify-center"><LoadingSpinner /></div>;

    return (
        <div className="p-4 space-y-3">
            <div onClick={onNavigateToNova} className="flex items-center p-3 bg-gradient-to-r from-purple-50 to-sky-50 dark:from-purple-900/30 dark:to-sky-900/30 rounded-lg cursor-pointer hover:shadow-lg transition-shadow">
                <div className="p-3 bg-gradient-to-br from-purple-400 to-sky-500 rounded-full mr-4">
                    <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-grow">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ask Nova</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">Your AI Assistant</p>
                </div>
            </div>
            {conversations.length === 0 && !loading ? (
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
    );
};

const InboxScreen: React.FC<InboxScreenProps> = ({ onViewProfile, onNavigateToChat, onNavigateToNova }) => {
    const [activeSubTab, setActiveSubTab] = useState<'messages' | 'activity'>('messages');

    return (
        <div className="w-full h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h1 className="text-2xl font-bold">Inbox</h1>
            </header>

            <div className="flex justify-center space-x-2 border-b border-gray-200 dark:border-gray-800">
                {(['messages', 'activity'] as const).map(type => (
                    <button key={type} onClick={() => setActiveSubTab(type)} className={`capitalize px-4 py-2 text-sm font-semibold relative ${activeSubTab === type ? 'text-sky-500' : 'text-gray-500'}`}>
                        {type}
                        {activeSubTab === type && <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" layoutId="inboxUnderline" />}
                    </button>
                ))}
            </div>

            {activeSubTab === 'activity' ? (
                <ActivityContent onViewProfile={onViewProfile} />
            ) : (
                <MessagesContent onNavigateToChat={onNavigateToChat} onNavigateToNova={onNavigateToNova} />
            )}
        </div>
    );
};

export default InboxScreen;
