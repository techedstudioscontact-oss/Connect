import React, { useState, useEffect } from 'react';
import { 
  Bell, Search, Home, MessageSquare, Gamepad2, Settings, Video 
} from 'lucide-react';
import { TabType, ChatModeType } from './types';
import { 
  HomeTab, ChatTab, GamesTab, SearchTab, ProfileTab, NavItem, DmConversation, SettingsModal, AuthScreen, NotificationsModal, NovaScreen, UserProfile
} from './components';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { App as CapApp } from '@capacitor/app';
import { CallModal } from './components';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Peer from 'peerjs';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [chatMode, setChatMode] = useState<ChatModeType>('global');
  const [activeDm, setActiveDm] = useState<any | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'account' | 'notifications' | 'security' | 'appearance' | 'help'>('main');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'|'system'>(() => {
    return (localStorage.getItem('connect-theme') as 'light'|'dark'|'system') || 'system';
  });
  const [isOnline, setIsOnline] = useState(true);
  const [viewingUser, setViewingUser] = useState<any | null>(null);
  const [activeCall, setActiveCall] = useState<any | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);

  // Request native permissions on mount
  useEffect(() => {
    const requestHardwarePermissions = async () => {
      try {
        await Camera.requestPermissions();
      } catch (e) { console.log('Camera permission failed', e); }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      } catch (e) { console.log('Microphone permission failed', e); }

      try {
        await PushNotifications.requestPermissions();
      } catch (e) { console.log('Notification permission failed', e); }
    };
    
    // Slight delay to ensure app is fully rendered before prompting
    setTimeout(requestHardwarePermissions, 1000);
  }, []);

  useEffect(() => {
    // Safely check online status after mount to prevent SSR/Webview false negatives
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('connect-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // Handle system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          name: user.displayName || (user.isAnonymous ? 'Guest User' : 'User'),
          avatar: user.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'
        });
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });

    // Listen for custom profile update events to refresh the header instantly
    const handleProfileUpdate = async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setCurrentUser({
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || (auth.currentUser.isAnonymous ? 'Guest User' : 'User'),
          avatar: auth.currentUser.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'
        });
      }
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  // Initialize PeerJS for incoming calls
  useEffect(() => {
    if (!currentUser?.uid) return;

    const newPeer = new Peer(currentUser.uid);
    setPeer(newPeer);

    newPeer.on('call', (call) => {
      // Find user info for the caller (this would ideally come from a signal or Firebase)
      // For now, we'll show a generic incoming call and fetch name later
      setIncomingCall(call);
      setActiveCall({ 
        user: { id: call.peer, name: 'Incoming Call...', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80' }, 
        isVideo: true, 
        isIncoming: true 
      });
      window.history.pushState({ modal: 'call' }, '');
    });

    return () => {
      newPeer.destroy();
    };
  }, [currentUser?.uid]);

  // Handle hardware back button for app-level modals (DMs, Settings, Notifications)
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (viewingUser) {
        closeUserProfile();
      } else if (activeDm) {
        closeDm();
      } else if (isSettingsOpen) {
        closeSettings();
      } else if (isNotificationsOpen) {
        closeNotifications();
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [activeDm, isSettingsOpen, isNotificationsOpen, viewingUser, activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      if (viewingUser) setViewingUser(null);
      if (activeDm) setActiveDm(null);
      if (isSettingsOpen) setIsSettingsOpen(false);
      if (isNotificationsOpen) setIsNotificationsOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeDm, isSettingsOpen, isNotificationsOpen, viewingUser]);

  const openDm = (user: any) => {
    setActiveDm(user);
    window.history.pushState({ modal: 'dm' }, '');
  };

  const closeDm = () => {
    if (window.history.state?.modal === 'dm') {
      window.history.back();
    } else {
      setActiveDm(null);
    }
  };

  const openSettings = (view: 'main' | 'account' | 'notifications' | 'security' | 'appearance' | 'help' = 'main') => {
    setSettingsView(view);
    setIsSettingsOpen(true);
    window.history.pushState({ modal: 'settings' }, '');
  };

  const closeSettings = () => {
    if (window.history.state?.modal === 'settings') {
      window.history.back();
    } else {
      setIsSettingsOpen(false);
    }
  };

  const openNotifications = () => {
    setIsNotificationsOpen(true);
    window.history.pushState({ modal: 'notifications' }, '');
  };

  const closeNotifications = () => {
    if (window.history.state?.modal === 'notifications') {
      window.history.back();
    } else {
      setIsNotificationsOpen(false);
    }
  };

  const openUserProfile = (user: any) => {
    setViewingUser(user);
    window.history.pushState({ modal: 'profile_view' }, '');
  };

  const closeUserProfile = () => {
    if (window.history.state?.modal === 'profile_view') {
      window.history.back();
    } else {
      setViewingUser(null);
    }
  };

  const startDmFromProfile = (user: any) => {
    setViewingUser(null);
    openDm(user);
  };

  const startCall = (user: any, isVideo: boolean = false) => {
    setActiveCall({ user, isVideo });
    window.history.pushState({ modal: 'call' }, '');
  };

  const closeCall = () => {
    if (window.history.state?.modal === 'call') {
      window.history.back();
    } else {
      setActiveCall(null);
      setIncomingCall(null);
    }
  };

  if (authLoading) {
    return (
      <div className="h-[100dvh] w-full bg-neutral-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLogin={setCurrentUser} />;
  }

  return (
    <div className="h-[100dvh] w-full bg-neutral-100 dark:bg-slate-950 font-sans flex justify-center overflow-hidden text-slate-900 dark:text-slate-100">
      {!isOnline && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center animate-pulse">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-3.674m0 0L3 3m3.343 3.343L3 3" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">You're Offline</h2>
          <p className="text-slate-400 max-w-xs font-medium leading-relaxed mb-8">
            Connect requires an active internet connection to work. Please check your network and try again.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold shadow-xl hover:scale-105 transition-transform"
          >
            Retry Connection
          </button>
        </div>
      )}
      {/* Main App Container */}
      <div className="relative w-full h-full md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto overflow-hidden bg-[#faf9f6] dark:bg-[#0c1222] shadow-2xl sm:border-x border-black/5 flex flex-col">
        
        {/* Soft Multi-color Gradient Background (mostly for Home and Profile) */}
        {activeTab !== 'chat' && (
          <div className="fixed inset-0 app-bg-gradient pointer-events-none z-0" />
        )}
        {activeTab === 'chat' && (
          <div className="absolute inset-0 app-bg-secondary opacity-100 z-0" />
        )}

        {/* Scrollable Content View */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto no-scrollbar pb-[110px] pt-8 sm:pt-12 px-5 relative z-10 flex flex-col">
          
          {/* Main Header Row (Hidden on Chat Tab as it has its own header) */}
          {activeTab !== 'chat' && (
            <div className="flex items-center justify-between mb-8 shrink-0">
              <h1 className="text-[28px] font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-[1px]">
                C<span className="relative inline-flex justify-center items-center">
                  o<span className="absolute w-[120%] h-[2.5px] bg-slate-900 dark:bg-white rotate-[-45deg] rounded-full"></span>
                </span>nnact
              </h1>
              <div className="flex gap-3">
                <button 
                  onClick={openNotifications}
                  className="relative w-[42px] h-[42px] bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border border-white/40 dark:border-slate-700/40 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <Bell className="w-5 h-5 text-slate-800" strokeWidth={2.5} />
                  <span className="absolute top-2.5 right-2 w-[10px] h-[10px] bg-rose-500 rounded-full border-[1.5px] border-white shadow-sm"></span>
                </button>
                <button 
                  onClick={() => setActiveTab('profile')} 
                  className={`w-[42px] h-[42px] p-[2px] backdrop-blur-md rounded-full flex items-center justify-center shadow-sm border transition-all ${activeTab === 'profile' ? 'bg-[#173e35] border-[#173e35]' : 'bg-white/50 border-white/40 hover:bg-white/60'}`}
                >
                  <img src={currentUser.avatar} className="w-full h-full rounded-full object-cover" alt="Profile" />
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Content */}
          <div className="w-full flex-1 flex flex-col relative" key={activeTab}>
            {activeTab === 'home' && <HomeTab onViewProfile={openUserProfile} />}
            {activeTab === 'chat' && <ChatTab chatMode={chatMode} setChatMode={setChatMode} onSelectDm={openDm} onViewProfile={openUserProfile} />}
            {activeTab === 'games' && <GamesTab />}
            {activeTab === 'search' && <SearchTab onSelectDm={openDm} onViewProfile={openUserProfile} />}
            {activeTab === 'profile' && <ProfileTab onEditProfile={() => openSettings('account')} onOpenSettings={() => openSettings()} />}
            {activeTab === 'video' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 animate-slide-up">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                   <Video className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Connact Video</h3>
                <p className="text-slate-500 max-w-xs mb-8">Connect with random people across the globe. This feature is coming soon!</p>
                <div className="px-6 py-2 bg-slate-200 text-slate-600 rounded-full font-bold text-sm">Under Development</div>
              </div>
            )}
          </div>

        </div>



        {/* Floating Bottom Navigation */}
        <div className="absolute bottom-5 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl h-[76px] bg-white/75 dark:bg-slate-900/75 backdrop-blur-2xl md:rounded-[38px] rounded-[28px] border-[1.5px] border-white dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-between px-5 md:px-8 z-50">
          <NavItem 
            icon={<Home className={`w-6 h-6 ${activeTab === 'home' ? 'text-[#173e35]' : 'text-slate-500'}`} strokeWidth={2.5}/>} 
            label="HOME" 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')}
          />
          <NavItem 
            icon={<MessageSquare className={`w-[22px] h-[22px] ${activeTab === 'chat' ? 'text-[#173e35]' : 'text-slate-500'}`} strokeWidth={2.2}/>} 
            label="GLOBAL CHAT" 
            active={activeTab === 'chat'} 
            onClick={() => { setActiveTab('chat'); setChatMode('global'); }}
          />
          <NavItem 
            icon={<Gamepad2 className={`w-6 h-6 ${activeTab === 'games' ? 'text-[#173e35]' : 'text-slate-500'}`} strokeWidth={2.2} />} 
            label="GAMES" 
            active={activeTab === 'games'}
            onClick={() => setActiveTab('games')}
          />
          <NavItem 
            icon={<Search className={`w-[22px] h-[22px] ${activeTab === 'search' ? 'text-[#173e35]' : 'text-slate-500'}`} strokeWidth={2.2} />} 
            label="SEARCH" 
            active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
          />
          <NavItem 
            icon={<Video className={`w-6 h-6 ${activeTab === 'video' ? 'text-[#173e35]' : 'text-slate-500'}`} strokeWidth={2.2} />} 
            label="CONNECT" 
            active={activeTab === 'video'}
            onClick={() => setActiveTab('video')}
          />
        </div>
        
        
        {activeDm && (
          activeDm.userId === 'nova_ai' ? (
            <NovaScreen onClose={closeDm} />
          ) : (
            <DmConversation 
              user={activeDm} 
              onClose={closeDm} 
              onCall={(u) => startCall(u, false)}
              onVideoCall={(u) => startCall(u, true)}
            />
          )
        )}
        
        {activeCall && (
          <CallModal 
            otherUser={activeCall.user} 
            isIncoming={activeCall.isIncoming}
            incomingCall={incomingCall}
            peer={peer}
            onClose={closeCall} 
          />
        )}
        
        {viewingUser && (
          <UserProfile 
            user={viewingUser} 
            onClose={closeUserProfile} 
            onMessage={startDmFromProfile}
          />
        )}
        
        {isSettingsOpen && (
          <SettingsModal 
            onClose={closeSettings} 
            onLogout={() => {
              if (window.confirm("Are you sure you want to log out?")) {
                auth.signOut();
                closeSettings();
              }
            }} 
            initialView={settingsView}
            theme={theme}
            setTheme={setTheme}
          />
        )}
        
        {isNotificationsOpen && (
          <NotificationsModal onClose={closeNotifications} />
        )}
      </div>
    </div>
  );
}
