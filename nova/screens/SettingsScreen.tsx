import React from 'react';
import { useAuth } from '../App';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import ThemeToggle from '../components/ThemeToggle';
import { ArrowLeftIcon } from '../components/icons';

interface SettingsScreenProps {
    onBack: () => void;
    onNavigateToBlockedUsers: () => void; // New prop
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onNavigateToBlockedUsers }) => {
    const { userProfile } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            // The onAuthStateChanged listener in App.tsx will handle the redirect
        } catch (error) {
            console.error("Error signing out: ", error);
            alert('Failed to log out.');
        }
    };
    
    const SettingItem: React.FC<{onClick?: () => void, children: React.ReactNode}> = ({ onClick, children }) => (
        <button onClick={onClick} className="w-full text-left flex justify-between items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md">
            {children}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                <h1 className="font-bold text-lg ml-4">Settings</h1>
            </header>
            <main className="flex-grow p-4 overflow-y-auto text-gray-800 dark:text-gray-200">
                <div className="space-y-6">
                    <div className="p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="font-semibold mb-2 text-gray-500 dark:text-gray-400 text-sm">Account</h2>
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                           <div className="py-2">
                             <p className="font-semibold">{userProfile?.name}</p>
                             <p className="text-sm text-gray-500">{userProfile?.email}</p>
                           </div>
                        </div>
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="font-semibold mb-1 text-gray-500 dark:text-gray-400 text-sm">Preferences</h2>
                         <div className="divide-y divide-gray-100 dark:divide-gray-800">
                            <SettingItem>
                                <span>Appearance</span>
                                <ThemeToggle />
                            </SettingItem>
                             <SettingItem>
                                <span>Manage Notifications</span>
                            </SettingItem>
                             <SettingItem onClick={onNavigateToBlockedUsers}>
                                <span>Blocked Users</span>
                                <span className="text-gray-400">&rarr;</span>
                            </SettingItem>
                             <SettingItem>
                                <span>Change Password</span>
                            </SettingItem>
                        </div>
                    </div>

                     <div className="p-4 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <h2 className="font-semibold mb-2 text-gray-500 dark:text-gray-400 text-sm">About</h2>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            A modern social platform connecting brands and influencers for creative, authentic collaborations.
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 leading-relaxed">
                            Version: 1.0.0<br/>
                            © 2025 Teched Studios. All rights reserved.<br/>
                            Founders: Prajjwal Kumar Gupta & Shresta Arun<br/>
                            Contact: <a href="mailto:techedstudios.contact@gmail.com" className="text-sky-500 hover:underline">techedstudios.contact@gmail.com</a><br/>
                            <a href="https://techedstudioscontact-oss.github.io/Teched-Studios-/" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">Official site of Teched Studios — powering CollabSea™</a>
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <button 
                            onClick={handleLogout} 
                            className="w-full text-center p-3 text-sky-600 font-semibold bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors"
                        >
                            Log Out
                        </button>
                         <button 
                            className="w-full text-center p-3 text-red-500 font-semibold bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            Delete Account
                        </button>
                    </div>
                </div>
            </main>
            <footer className="text-center p-4 text-xs text-gray-500 dark:text-gray-400">
                <p className="font-semibold">CollabSea v1.0</p>
            </footer>
        </div>
    );
};

export default SettingsScreen;