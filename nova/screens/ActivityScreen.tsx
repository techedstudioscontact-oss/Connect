
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, writeBatch, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Notification, NotificationType, UserProfile } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { HeartIcon, ChatBubbleOvalLeftIcon, UserPlusIcon, MegaphoneIcon, SparklesIcon } from '../components/icons';
import { fetchUsersForItems } from '../utils/firebaseUtils';

interface ActivityScreenProps {
    onViewProfile: (user: UserProfile) => void;
}

const NotificationItem: React.FC<{ notification: Notification, onViewProfile: (user: UserProfile) => void }> = ({ notification, onViewProfile }) => {
    
    // Special rendering for System Alerts
    if (notification.type === NotificationType.SYSTEM_ALERT) {
        return (
            <div className="flex items-start p-4 space-x-4 bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500 mb-1">
                <div className="h-10 w-10 rounded-full flex items-center justify-center bg-sky-500 text-white shrink-0">
                    <SparklesIcon className="h-6 w-6" />
                </div>
                <div className="flex-grow">
                     <p className="text-sm text-gray-900 dark:text-gray-100 font-semibold">
                        System Update
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-wrap">
                        {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        {notification.createdAt ? new Date(notification.createdAt.toDate()).toLocaleDateString() : ''}
                    </p>
                </div>
            </div>
        );
    }

    const getIcon = () => {
        const iconContainerClass = "h-10 w-10 rounded-full flex items-center justify-center shrink-0";
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

    // Regular notification rendering
    if (!notification.senderProfile) return null;

    return (
        <div className="flex items-center p-3 space-x-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onViewProfile(notification.senderProfile!)}>
            {getIcon()}
            <div className="flex-grow">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                    <span className="font-semibold">{notification.senderProfile?.name}</span> {notification.message}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{notification.createdAt ? timeAgo(notification.createdAt.toDate()) : ''}</p>
            </div>
             <img src={notification.senderProfile?.avatar} alt={notification.senderProfile?.name} className="w-10 h-10 rounded-full" />
        </div>
    );
};

const ActivityScreen: React.FC<ActivityScreenProps> = ({ onViewProfile }) => {
    const { userProfile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userProfile?.uid) return;

        setLoading(true);
        // FIX: Removed orderBy('createdAt', 'desc') to avoid "Index Required" error.
        // Sorting is now handled client-side.
        // Increased limit slightly to ensure we capture recent items even without strict server ordering.
        const notifsQuery = query(
            collection(db, 'notifications'),
            where('recipientId', '==', userProfile.uid),
            limit(100)
        );

        const unsubscribe = onSnapshot(notifsQuery, async (snapshot) => {
            const notifsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
            
            // Filter out system alerts to process separately, then merge back
            const regularNotifs = notifsData.filter(n => n.type !== NotificationType.SYSTEM_ALERT);
            const systemNotifs = notifsData.filter(n => n.type === NotificationType.SYSTEM_ALERT);
            
            const regularNotifsWithSenders = await fetchUsersForItems(regularNotifs, 'senderId', 'senderProfile');
            
            // Combine and sort client-side
            const combined = [...systemNotifs, ...regularNotifsWithSenders];
            combined.sort((a, b) => {
                const timeA = a.createdAt?.toMillis() || 0;
                const timeB = b.createdAt?.toMillis() || 0;
                return timeB - timeA;
            });

            setNotifications(combined as Notification[]);
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

    return (
        <div className="w-full h-full bg-white dark:bg-black">
             <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <h1 className="text-2xl font-bold">Activity</h1>
            </header>
            {loading ? (
                <div className="flex justify-center mt-8">
                    <LoadingSpinner />
                </div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-16 px-4">
                    <h2 className="font-semibold text-lg">No Activity Yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Your notifications will appear here.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {notifications.map(notif => <NotificationItem key={notif.id} notification={notif} onViewProfile={onViewProfile} />)}
                </div>
            )}
        </div>
    );
};

export default ActivityScreen;
