

import React, { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, setDoc, where, limit, getDocs, Timestamp } from 'firebase/firestore';
import { auth, db, messaging } from './firebase';
import { UserProfile, Role, Message, Conversation, NotificationType } from './types';
import { getToken, onMessage } from 'firebase/messaging';
import { motion, AnimatePresence } from 'framer-motion';

import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import CreateScreen from './screens/CreateScreen';
import InboxScreen from './screens/InboxScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import ApplicantsScreen from './screens/ApplicantsScreen';
import NovaScreen from './screens/NovaScreen';
import FollowersScreen from './screens/FollowersScreen';
import FollowingScreen from './screens/FollowingScreen';
import BlockedUsersScreen from './screens/BlockedUsersScreen';
import { LoadingSpinner } from './components/LoadingSpinner';
import NotificationToast from './components/NotificationToast';
import { PaperAirplaneIcon, ArrowLeftIcon, MicrophoneIcon, StopIcon, PlayIcon, PauseIcon, CheckBadgeIcon } from './components/icons';
import { uploadMedia } from './utils/firebaseUtils';


type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

// FIX: Made children prop optional to resolve incorrect "missing children" error.
const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubProfile(); // Clean up old profile subscription

      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        try {
          // First, check if the document exists.
          const docSnap = await getDoc(userDocRef);

          if (!docSnap.exists()) {
            // Profile doesn't exist, create a default one.
            console.warn(`No profile found for user ${firebaseUser.uid}, creating a default one.`);
            const newUserProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'New User',
              email: firebaseUser.email!,
              role: Role.INFLUENCER, // Default to Influencer
              bio: '',
              website: '',
              avatar: firebaseUser.photoURL || `https://i.pravatar.cc/150?u=${firebaseUser.uid}`,
              socials: {},
              followerCounts: {},
              following: [],
              blockedUsers: [],
              likedPosts: [],
              savedPosts: [],
              savedCampaigns: []
            };
            await setDoc(userDocRef, newUserProfile);
            // The snapshot listener below will pick up the newly created profile.
          }
        
          // Now that we're sure the doc exists, set up the listener.
          unsubProfile = onSnapshot(userDocRef, 
            (doc) => {
              setUserProfile(doc.exists() ? (doc.data() as UserProfile) : null);
              setLoading(false);
            },
            (error) => {
              console.error("Profile subscription error:", error);
              // FIX: An invalid profile state should not be allowed. Sign out to recover.
              // This prevents an infinite loading screen if the user's profile document is inaccessible.
              signOut(auth).catch(e => console.error("Error signing out after profile failure:", e));
              setUser(null);
              setUserProfile(null);
              setLoading(false);
            }
          );

        } catch (error) {
            console.error("Error during profile check/creation:", error);
            // If anything fails during the check/creation, sign out to prevent an invalid state.
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
            setLoading(false);
        }

      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubProfile();
    };
  }, []);


  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};


type Theme = 'light' | 'dark';
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// FIX: Made children prop optional to resolve incorrect "missing children" error.
const ThemeProvider = ({ children }: { children?: ReactNode }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const storedTheme = localStorage.getItem('theme');
            if (storedTheme) {
                return storedTheme as Theme;
            }
        } catch (e) {
            console.warn("localStorage is not available for theme storage:", e);
        }
        
        try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                return 'dark';
            }
        } catch (e) {
            console.warn("matchMedia is not available:", e);
        }
        return 'light';
    });

    useEffect(() => {
        try {
            const root = window.document.documentElement;
            root.classList.remove(theme === 'dark' ? 'light' : 'dark');
            root.classList.add(theme);
            localStorage.setItem('theme', theme);
        } catch (e) {
            console.warn("Failed to set theme in localStorage or classList:", e);
        }
    }, [theme]);
    
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};


interface ChatScreenProps {
    conversationId: string;
    recipient: UserProfile;
    currentUser: UserProfile;
    onBack: () => void;
}

const AudioMessage = ({ audioUrl, isSender }: { audioUrl: string, isSender: boolean }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // If audioUrl is missing or invalid, don't try to render controls
    if (!audioUrl) return null;

    const togglePlay = async () => {
        if (!audioRef.current) return;
        try {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                await audioRef.current.play();
            }
        } catch (error) {
            console.error("Playback failed:", error);
            setIsPlaying(false);
        }
    };

    return (
        <div className={`flex items-center space-x-2 p-2 rounded-lg ${isSender ? 'bg-sky-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'}`}>
            <audio 
                key={audioUrl} // Force re-render if URL changes
                ref={audioRef} 
                src={audioUrl}
                preload="metadata"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={(e) => console.error("Audio playback error", e)}
                className="hidden"
            />
            <button onClick={togglePlay} className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </button>
            <span className="text-xs font-semibold">Voice Note</span>
        </div>
    );
}

const ChatScreen: React.FC<ChatScreenProps> = ({ conversationId, recipient, currentUser, onBack }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [isSendingAudio, setIsSendingAudio] = useState(false);

    useEffect(() => {
        setLoading(true);
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            setMessages(msgs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching messages:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [conversationId]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            
            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
                // Use the recorder's reported mimeType for better compatibility (e.g. audio/mp4 on Safari)
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const blob = new Blob(chunks, { type: mimeType });
                setAudioBlob(blob);
            };
            
            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const cancelRecording = () => {
        stopRecording();
        setAudioBlob(null);
    };

    const sendAudioMessage = async () => {
        if (!audioBlob) return;
        setIsSendingAudio(true);
        try {
            const { url } = await uploadMedia(audioBlob, currentUser.uid, 'audio');
            
            const messagesRef = collection(db, 'conversations', conversationId, 'messages');
            await addDoc(messagesRef, {
                text: '', // Empty text for audio messages
                audioUrl: url,
                senderId: currentUser.uid,
                receiverId: recipient.uid,
                timestamp: serverTimestamp()
            });

            const conversationRef = doc(db, 'conversations', conversationId);
            await updateDoc(conversationRef, {
                lastMessage: '🎤 Voice Note',
                lastUpdatedAt: serverTimestamp()
            });

            setAudioBlob(null);
        } catch (error) {
            console.error("Error sending audio:", error);
            alert("Failed to send audio message.");
        } finally {
            setIsSendingAudio(false);
        }
    }

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        const text = newMessage;
        setNewMessage('');

        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        await addDoc(messagesRef, {
            text: text,
            senderId: currentUser.uid,
            receiverId: recipient.uid,
            timestamp: serverTimestamp()
        });
        
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
            lastMessage: text,
            lastUpdatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'notifications'), {
            recipientId: recipient.uid,
            senderId: currentUser.uid,
            type: NotificationType.NEW_MESSAGE,
            entityId: conversationId,
            message: `sent you a message.`,
            read: false,
            createdAt: serverTimestamp()
        });
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black">
            <header className="sticky top-0 bg-white dark:bg-black z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-4">
                <button onClick={onBack} className="text-gray-900 dark:text-gray-100 p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <img src={recipient.avatar} alt={recipient.name} className="w-10 h-10 rounded-full" />
                <div className="flex items-center gap-1">
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">{recipient.name}</h1>
                    {recipient.isVerified && <CheckBadgeIcon className="h-4 w-4 text-blue-500" />}
                </div>
            </header>
            <main className="flex-grow p-4 overflow-y-auto">
                {loading ? <div className="flex justify-center items-center h-full"><LoadingSpinner /></div> : (
                    <div className="space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={`w-full flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}>
                                <div className="flex items-end gap-2 max-w-[85%]">
                                    {msg.senderId !== currentUser.uid && (
                                        <img 
                                            src={recipient.avatar} 
                                            alt={recipient.name} 
                                            className="w-6 h-6 rounded-full" 
                                        />
                                    )}
                                    
                                    <div className="flex flex-col">
                                        <div className={`px-3 py-2 rounded-xl ${msg.senderId === currentUser.uid ? 'bg-sky-500 text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'}`}>
                                            {msg.audioUrl ? (
                                                <AudioMessage audioUrl={msg.audioUrl} isSender={msg.senderId === currentUser.uid} />
                                            ) : (
                                                <p className="text-sm break-words">{msg.text}</p>
                                            )}
                                        </div>
                                        
                                        {msg.timestamp && (
                                            <p className={`text-xs text-gray-400 dark:text-gray-500 mt-1 px-1 ${msg.senderId === currentUser.uid ? 'text-right' : 'text-left'}`}>
                                                {(msg.timestamp as Timestamp).toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>
            <footer className="p-2 sm:p-4 bg-white dark:bg-black border-t border-gray-200 dark:border-gray-800">
                {audioBlob ? (
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 rounded-full p-2">
                         <button onClick={cancelRecording} className="p-2 text-red-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><StopIcon className="h-5 w-5"/></button>
                         <span className="text-sm font-semibold text-sky-500">Audio Recorded</span>
                         <button onClick={sendAudioMessage} disabled={isSendingAudio} className="p-2 bg-sky-500 text-white rounded-full">
                            {isSendingAudio ? <LoadingSpinner size="sm" /> : <PaperAirplaneIcon className="h-5 w-5"/>}
                         </button>
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Message..."
                            className="flex-grow p-3 border rounded-full bg-gray-100 dark:bg-gray-800 border-transparent focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"
                        />
                        {newMessage.trim() ? (
                            <button type="submit" className="p-3 bg-sky-500 text-white rounded-full transition-all hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                                <PaperAirplaneIcon className="h-6 w-6" />
                            </button>
                        ) : (
                             <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
                                className={`p-3 rounded-full transition-all focus:outline-none ${isRecording ? 'bg-red-500 text-white scale-110' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                                <MicrophoneIcon className="h-6 w-6" />
                            </button>
                        )}
                    </form>
                )}
            </footer>
        </div>
    );
}


const MainApp = () => {
    const [activeTab, setActiveTab] = useState('home');
    const { userProfile } = useAuth();
    const [viewedUserId, setViewedUserId] = useState<string | null>(null);
    const [activeChat, setActiveChat] = useState<{ conversationId: string; recipient: UserProfile } | null>(null);
    const [modalScreen, setModalScreen] = useState<string | null>(null);
    const [viewingApplicantsFor, setViewingApplicantsFor] = useState<{ campaignId: string, campaignTitle: string } | null>(null);
    const [foregroundNotification, setForegroundNotification] = useState<{ title: string; body: string } | null>(null);
    const [isNovaChatActive, setIsNovaChatActive] = useState(false);
    const [novaInitialPrompt, setNovaInitialPrompt] = useState<string | null>(null); // New state for passing prompts to Nova
    const [viewingFollowersFor, setViewingFollowersFor] = useState<string | null>(null);
    const [viewingFollowingFor, setViewingFollowingFor] = useState<string | null>(null);
    const [viewingBlockedUsers, setViewingBlockedUsers] = useState(false);
    
    // System Announcement Logic
    useEffect(() => {
        if (!userProfile) return;
        const checkSystemNotifications = async () => {
            const announcementId = "v2_launch_announcement";
            // Check if user has already received this specific announcement
            // (Using local storage for simple client-side check to avoid Firestore spam, 
            // though ideally this would be checked against a 'read' receipt in db)
            const hasSeen = localStorage.getItem(`seen_announcement_${announcementId}`);
            
            if (!hasSeen) {
                // Send a local system notification to the user's notification feed
                await addDoc(collection(db, 'notifications'), {
                    recipientId: userProfile.uid,
                    senderId: 'SYSTEM',
                    senderProfile: {
                         uid: 'SYSTEM',
                         name: 'CollabSea Team',
                         email: 'support@collabsea.com',
                         role: Role.BRAND,
                         avatar: 'https://ui-avatars.com/api/?name=Collab+Sea&background=0D8ABC&color=fff',
                         isVerified: true
                    },
                    type: NotificationType.SYSTEM_ALERT,
                    entityId: announcementId,
                    message: "🎉 New Features: Voice Notes in Chat & Verified Badges are here! Send audio messages to your connections and look out for the Blue Tick.",
                    read: false,
                    createdAt: serverTimestamp()
                });
                
                localStorage.setItem(`seen_announcement_${announcementId}`, 'true');
            }
        };
        checkSystemNotifications();
    }, [userProfile]);
    
    useEffect(() => {
        if (!messaging) return;
        const unsubscribe = onMessage(messaging, (payload) => {
            console.log('Message received in foreground. ', payload);
            if (payload.notification) {
                setForegroundNotification({
                    title: payload.notification.title || 'New Notification',
                    body: payload.notification.body || ''
                });
            }
        });

        return () => unsubscribe();
    }, []);

    const handleStartChat = async (recipient: UserProfile) => {
        if (!userProfile || recipient.uid === userProfile.uid) return;
        
        // Prevent chatting if blocked
        if (userProfile.blockedUsers?.includes(recipient.uid)) {
            alert("You have blocked this user.");
            return;
        }

        const conversationId = [userProfile.uid, recipient.uid].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);

        const docSnap = await getDoc(conversationRef);
        if (!docSnap.exists()) {
            await setDoc(conversationRef, {
                participants: [userProfile.uid, recipient.uid],
                lastUpdatedAt: serverTimestamp(),
                lastMessage: ''
            });
        }
        
        setActiveChat({ conversationId, recipient });
    };
    
    const handleNavigateToConversation = (conversationId: string, recipient: UserProfile) => {
        setActiveChat({ conversationId, recipient });
    };

    const handleViewProfile = (userToView: UserProfile) => {
        if (userToView.uid !== userProfile?.uid) {
            setViewedUserId(userToView.uid);
        } else {
            setActiveTab('profile');
            setViewedUserId(null);
        }
    };

    const handleAnalyzeProfile = (prompt: string) => {
        setNovaInitialPrompt(prompt);
        setIsNovaChatActive(true);
    };
    
    const handleViewApplicants = (campaignId: string, campaignTitle: string) => {
        setViewingApplicantsFor({ campaignId, campaignTitle });
    };

    const handleViewFollowers = (userId: string) => {
        setViewingFollowersFor(userId);
    };

    const handleViewFollowing = (userId: string) => {
        setViewingFollowingFor(userId);
    };


    if (!userProfile) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100">
                <LoadingSpinner />
                <p className="ml-4 mt-4">Loading profile...</p>
            </div>
        )
    }

    // Render Order Logic: Overlays first, then Profile, then Main Tabs
    
    if (isNovaChatActive) {
        return <NovaScreen 
                    onBack={() => {
                        setIsNovaChatActive(false);
                        setNovaInitialPrompt(null);
                    }} 
                    initialPrompt={novaInitialPrompt}
                />
    }

    if (viewingBlockedUsers) {
        return <BlockedUsersScreen onBack={() => setViewingBlockedUsers(false)} />;
    }

    if (viewingApplicantsFor) {
        return <ApplicantsScreen 
                    campaignId={viewingApplicantsFor.campaignId}
                    campaignTitle={viewingApplicantsFor.campaignTitle}
                    onBack={() => setViewingApplicantsFor(null)}
                    onViewProfile={handleViewProfile}
                    onStartChat={handleStartChat}
                />
    }
    
    if (viewingFollowersFor) {
        return <FollowersScreen 
            userId={viewingFollowersFor}
            onBack={() => setViewingFollowersFor(null)}
            onViewProfile={handleViewProfile}
            onStartChat={handleStartChat}
        />
    }

    if (viewingFollowingFor) {
        return <FollowingScreen 
            userId={viewingFollowingFor}
            onBack={() => setViewingFollowingFor(null)}
            onViewProfile={handleViewProfile}
            onStartChat={handleStartChat}
        />
    }

    if (activeChat) {
        return <ChatScreen 
                    conversationId={activeChat.conversationId}
                    recipient={activeChat.recipient}
                    currentUser={userProfile}
                    onBack={() => setActiveChat(null)}
                />
    }
    
    if (modalScreen === 'editProfile') {
        return <EditProfileScreen onBack={() => setModalScreen(null)} />
    }
    
    if (modalScreen === 'settings') {
        return <SettingsScreen 
            onBack={() => setModalScreen(null)} 
            onNavigateToBlockedUsers={() => { setModalScreen(null); setViewingBlockedUsers(true); }}
        />
    }

    // Profile Screen (viewing other user)
    if (viewedUserId) {
        return <ProfileScreen 
                userIdToView={viewedUserId} 
                onBack={() => setViewedUserId(null)} 
                onStartChat={handleStartChat} 
                onViewApplicants={handleViewApplicants}
                onViewFollowers={handleViewFollowers}
                onViewFollowing={handleViewFollowing}
                onAnalyzeProfile={handleAnalyzeProfile}
               />;
    }

    const renderScreen = () => {
        switch (activeTab) {
            case 'home': return <HomeScreen onStartChat={handleStartChat} onViewProfile={handleViewProfile} onViewApplicants={handleViewApplicants} />;
            case 'search': return <SearchScreen onViewProfile={handleViewProfile} />;
            case 'create': return <CreateScreen onPostCreated={() => setActiveTab('home')} />;
            case 'inbox': return <InboxScreen onNavigateToChat={handleNavigateToConversation} onViewProfile={handleViewProfile} onNavigateToNova={() => setIsNovaChatActive(true)} />;
            case 'profile': return <ProfileScreen onNavigateToEditProfile={() => setModalScreen('editProfile')} onNavigateToSettings={() => setModalScreen('settings')} onStartChat={handleStartChat} onViewApplicants={handleViewApplicants} onViewFollowers={handleViewFollowers} onViewFollowing={handleViewFollowing} onAnalyzeProfile={handleAnalyzeProfile} />;
            default: return <HomeScreen onStartChat={handleStartChat} onViewProfile={handleViewProfile} onViewApplicants={handleViewApplicants} />;
        }
    };
    
    const animationVariants = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
    };

    return (
        <div className="w-full h-full min-h-screen max-w-md mx-auto bg-white dark:bg-black text-gray-900 dark:text-gray-100 flex flex-col">
            {foregroundNotification && (
                <NotificationToast 
                    title={foregroundNotification.title}
                    body={foregroundNotification.body}
                    onClose={() => setForegroundNotification(null)}
                />
            )}
            <main className="flex-grow pb-16 overflow-y-auto scrollbar-hide">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={animationVariants}
                        transition={{ duration: 0.15 }}
                        className="h-full w-full"
                    >
                        {renderScreen()}
                    </motion.div>
                </AnimatePresence>
            </main>
            <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
    );
};

const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        
        const requestPermissionsAndSetup = async () => {
            // 1. Setup Notifications
            if ('serviceWorker' in navigator) {
                 try { if (window.self !== window.top) return; } catch (e) { return; }
                try {
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted' && messaging) {
                        const vapidKey = 'BGlYQ1D2MAEb23wpgn1xNs2pAAZ_F8tpH1k2vYpZWEiZJ-aJ_iWwzO5C3ndjM2G2s2w_SRfflBfC-vQ4aSDN-zE';
                        const currentToken = await getToken(messaging, { vapidKey }); 
                        if (currentToken) {
                            const tokenDocRef = doc(db, 'users', user.uid, 'deviceTokens', currentToken);
                            await setDoc(tokenDocRef, { 
                                createdAt: serverTimestamp(),
                                platform: 'web'
                            });
                        }
                    }
                } catch (error) {
                    console.error('An error occurred during notification setup: ', error);
                }
            }

            // 2. Request Microphone permission
            try {
                if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    // Permission granted, stop the track immediately as we don't need it yet.
                    stream.getTracks().forEach(track => track.stop());
                }
            } catch (err) {
                console.warn("Microphone permission was not granted on startup.", err);
            }
        };

        requestPermissionsAndSetup();
    }, [user]);

    return <>{children}</>;
};

const AppContent = () => {
  const [showSplash, setShowSplash] = useState(true);
  const { user, loading } = useAuth();

  if (showSplash) {
    return <SplashScreen onFinished={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  return user ? <AppInitializer><MainApp /></AppInitializer> : <AuthScreen />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}