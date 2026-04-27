import React, { useState } from 'react';
import { 
  ChevronLeft, 
  User, 
  Bell, 
  Lock, 
  Palette, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Check
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { uploadMedia } from '../lib/firebaseUtils';

type SettingsView = 'main' | 'account' | 'notifications' | 'security' | 'appearance' | 'help';

interface SettingsModalProps {
  onClose: () => void;
  onLogout: () => void;
  initialView?: SettingsView;
  theme?: 'light'|'dark'|'system';
  setTheme?: (theme: 'light'|'dark'|'system') => void;
}

export function SettingsModal({ onClose, onLogout, initialView = 'main', theme = 'system', setTheme }: SettingsModalProps) {
  const [view, setView] = useState<SettingsView>(initialView);

  // States for sub-pages
  const [name, setName] = useState(auth.currentUser?.displayName || 'User');
  const [username, setUsername] = useState(`@${auth.currentUser?.uid.substring(0, 8)}` || '');
  const [profilePicUrl, setProfilePicUrl] = useState(auth.currentUser?.photoURL || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80');
  const [saving, setSaving] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);
  
  const [twoFactor, setTwoFactor] = useState(false);

  const settingsOptions = [
    { id: 'account', icon: <User className="w-5 h-5" />, label: 'Account', description: 'Manage your profile and details' },
    { id: 'notifications', icon: <Bell className="w-5 h-5" />, label: 'Notifications', description: 'Preferences and alerts' },
    { id: 'security', icon: <Lock className="w-5 h-5" />, label: 'Privacy & Security', description: 'Passwords and permissions' },
    { id: 'appearance', icon: <Palette className="w-5 h-5" />, label: 'Appearance', description: 'Theme and display options' },
    { id: 'help', icon: <HelpCircle className="w-5 h-5" />, label: 'Help & Support', description: 'FAQ and contact us' },
  ];

  const handleBack = () => {
    setView('main');
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setSaving(true);
    try {
      const { url } = await uploadMedia(file, auth.currentUser.uid, 'profile');
      
      await updateProfile(auth.currentUser, { photoURL: url });
      await setDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: url }, { merge: true });
      setProfilePicUrl(url);
    } catch (err) {
      console.error("Error uploading profile pic:", err);
      alert("Failed to upload image. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser || saving) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name });
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, { displayName: name }, { merge: true });
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'account':
        return (
          <div className="p-4 space-y-6 animate-slide-up">
            <div className="flex flex-col items-center mb-6">
              <div className="relative group cursor-pointer inline-block">
                <img src={profilePicUrl} alt="Profile" className={`w-24 h-24 object-cover rounded-full shadow-md border-4 border-white transition-opacity ${saving ? 'opacity-50' : 'group-hover:opacity-80'}`} />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <div className="bg-black/50 text-white p-2 rounded-full backdrop-blur-sm">
                      <User className="w-5 h-5" />
                   </div>
                </div>
                <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleProfileImageChange} disabled={saving} />
              </div>
            </div>
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-5 shadow-sm border border-white/60 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-slate-500 ml-1">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-slate-500 ml-1">Username (ID partial mask)</label>
                <input type="text" value={username} disabled className="w-full mt-1 bg-slate-100/50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] font-bold text-slate-400 focus:outline-none cursor-not-allowed" />
              </div>
            </div>
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className={`w-full text-white font-bold py-3.5 rounded-2xl shadow-lg transition-colors ${saving ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        );
      case 'notifications':
        return (
          <div className="p-4 space-y-4 animate-slide-up">
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-sm border border-white/60">
              <div className="flex items-center justify-between p-4 border-b border-slate-100/60">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Push Notifications</h3>
                  <p className="text-[12px] font-medium text-slate-500">Alerts on your device</p>
                </div>
                <button 
                  onClick={() => setPushEnabled(!pushEnabled)} 
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${pushEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${pushEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <h3 className="text-[15px] font-bold text-slate-900">Email Notifications</h3>
                  <p className="text-[12px] font-medium text-slate-500">Newsletters and updates</p>
                </div>
                <button 
                  onClick={() => setEmailEnabled(!emailEnabled)} 
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${emailEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${emailEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div className="p-4 space-y-4 animate-slide-up">
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-sm border border-white/60">
               <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-100/60 text-left">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">Change Password</h3>
                    <p className="text-[12px] font-medium text-slate-500">Last changed 3 months ago</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
               </button>
               <div className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">Two-Factor Auth</h3>
                    <p className="text-[12px] font-medium text-slate-500">Add an extra layer of security</p>
                  </div>
                  <button 
                    onClick={() => setTwoFactor(!twoFactor)} 
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${twoFactor ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${twoFactor ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
               </div>
            </div>
            <button className="w-full bg-rose-50 text-rose-600 font-bold py-3.5 rounded-2xl shadow-sm hover:bg-rose-100 transition-colors border border-rose-200">
              Delete Account
            </button>
          </div>
        );
      case 'appearance':
        return (
          <div className="p-4 space-y-4 animate-slide-up">
             <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-2 shadow-sm border border-white/60">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button 
                    key={t}
                    onClick={() => setTheme && setTheme(t)}
                    className="w-full flex items-center justify-between p-3 rounded-[16px] hover:bg-slate-100/50 transition-colors capitalize font-bold text-[14px] text-slate-800"
                  >
                     {t} Mode
                     {theme === t && <Check className="w-4 h-4 text-emerald-500" />}
                  </button>
                ))}
             </div>
          </div>
        );
      case 'help':
        return (
          <div className="p-4 space-y-4 animate-slide-up">
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] overflow-hidden shadow-sm border border-white/60">
               {[
                 { q: 'How do I change my handle?', a: 'Go to Account settings and edit your username.' },
                 { q: 'How do I start a DM?', a: 'Navigate to Chats, select DMs, and click on a friend.' },
                 { q: 'Is Connect free?', a: 'Yes! Core features are completely free.' }
               ].map((faq, i) => (
                 <div key={i} className="p-4 border-b border-slate-100/60 last:border-0">
                    <h4 className="text-[14px] font-bold text-slate-900 mb-1">{faq.q}</h4>
                    <p className="text-[13px] font-medium text-slate-500">{faq.a}</p>
                 </div>
               ))}
            </div>
            <button className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors">
              Contact Support
            </button>
          </div>
        );
      default:
        return (
          <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] p-2 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60">
              {settingsOptions.map((opt, i) => (
                <button 
                  key={i} 
                  onClick={() => setView(opt.id as SettingsView)}
                  className={`w-full flex items-center justify-between p-3.5 hover:bg-slate-100/50 transition-colors group ${i !== settingsOptions.length - 1 ? 'border-b border-slate-100/60' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-700 group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-100/50">
                      {opt.icon}
                    </div>
                    <div className="text-left">
                      <h3 className="text-[15px] font-bold text-slate-900 leading-tight mb-0.5">{opt.label}</h3>
                      <p className="text-[12px] font-medium text-slate-500">{opt.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </button>
              ))}
            </div>

            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 p-4 bg-white/80 backdrop-blur-xl rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white/60 text-rose-500 font-bold hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Log Out
            </button>
            
            <div className="text-center pb-8">
               <p className="text-[12px] font-medium text-slate-400">App Version 1.0.0</p>
            </div>
          </div>
        );
    }
  };

  const getTitle = () => {
     if (view === 'main') return 'Settings';
     const opt = settingsOptions.find(o => o.id === view);
     return opt ? opt.label : 'Settings';
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-none sm:p-4">
      <div className="w-full h-full max-w-[420px] sm:h-[850px] max-h-[100dvh] relative flex flex-col app-bg-secondary sm:rounded-[40px] shadow-2xl overflow-hidden sm:border-[6px] border-white/40 animate-slide-up pointer-events-auto">
        {/* Background Subtle Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#bbf5d8]/20 via-[#faf9f6] to-[#dfd5f6]/20 opacity-100 z-0 pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-4 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-[0_2px_15px_rgb(0,0,0,0.03)] pt-10 sm:pt-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={view === 'main' ? onClose : handleBack}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100/50 hover:bg-slate-200/50 text-slate-700 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-[20px] font-bold text-slate-900">{getTitle()}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
