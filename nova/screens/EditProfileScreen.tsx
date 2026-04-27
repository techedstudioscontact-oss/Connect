import React, { useState, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { uploadMedia } from '../utils/firebaseUtils';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface EditProfileScreenProps {
    onBack: () => void;
}

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ onBack }) => {
    const { user, userProfile } = useAuth();
    const [name, setName] = useState(userProfile?.name || '');
    const [website, setWebsite] = useState(userProfile?.website || '');
    const [bio, setBio] = useState(userProfile?.bio || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(userProfile?.avatar || null);
    
    // Socials state
    const [instagram, setInstagram] = useState(userProfile?.socials?.instagram || '');
    const [tiktok, setTiktok] = useState(userProfile?.socials?.tiktok || '');
    const [youtube, setYoutube] = useState(userProfile?.socials?.youtube || '');
    const [instagramFollowers, setInstagramFollowers] = useState(userProfile?.followerCounts?.instagram?.toString() || '');
    const [tiktokFollowers, setTiktokFollowers] = useState(userProfile?.followerCounts?.tiktok?.toString() || '');
    const [youtubeFollowers, setYoutubeFollowers] = useState(userProfile?.followerCounts?.youtube?.toString() || '');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setError('File is too large. Max size is 5MB.');
                return;
            }
            setError('');
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!user || !userProfile || loading) return;
        setLoading(true);
        setError('');

        try {
            const updates: { [key: string]: any } = {};
            if (name !== userProfile.name) updates.name = name;
            if (website !== (userProfile.website || '')) updates.website = website;
            if (bio !== (userProfile.bio || '')) updates.bio = bio;

            if (avatarFile) {
                const { url: avatarUrl } = await uploadMedia(avatarFile, user.uid, 'profile');
                updates.avatar = avatarUrl;
            }
            
            const newSocials = {
                instagram: instagram.replace('@', '').trim() || '',
                tiktok: tiktok.replace('@', '').trim() || '',
                youtube: youtube.replace('@', '').trim() || '',
            };
            const currentSocials = userProfile.socials || { instagram: '', tiktok: '', youtube: '' };
            if (newSocials.instagram !== (currentSocials.instagram || '') || 
                newSocials.tiktok !== (currentSocials.tiktok || '') || 
                newSocials.youtube !== (currentSocials.youtube || '')) {
                updates.socials = newSocials;
            }
            
            const newFollowerCounts = {
                instagram: parseInt(instagramFollowers) || 0,
                tiktok: parseInt(tiktokFollowers) || 0,
                youtube: parseInt(youtubeFollowers) || 0,
            };
            const currentFollowerCounts = userProfile.followerCounts || { instagram: 0, tiktok: 0, youtube: 0 };
            if (newFollowerCounts.instagram !== (currentFollowerCounts.instagram || 0) ||
                newFollowerCounts.tiktok !== (currentFollowerCounts.tiktok || 0) ||
                newFollowerCounts.youtube !== (currentFollowerCounts.youtube || 0)) {
                updates.followerCounts = newFollowerCounts;
            }

            if (Object.keys(updates).length > 0) {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, updates);
            }
            
            onBack();
        } catch (err: any) {
            console.error("Error updating profile: ", err);
            setError(err.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                <button onClick={onBack} className="text-lg text-gray-800 dark:text-gray-200">Cancel</button>
                <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Edit Profile</h1>
                <button onClick={handleSave} className="text-lg text-sky-500 font-bold" disabled={loading}>
                    {loading ? <LoadingSpinner size="sm"/> : 'Done'}
                </button>
            </header>
            <main className="flex-grow p-4 overflow-y-auto">
                <div className="space-y-6 max-w-lg mx-auto">
                    <div className="p-6 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex flex-col items-center space-y-4">
                          <img src={avatarPreview || `https://i.pravatar.cc/150?u=${user?.uid}`} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
                          <button onClick={() => fileInputRef.current?.click()} className="font-semibold text-sky-500 hover:text-sky-600 dark:hover:text-sky-400">
                              Change Profile Photo
                          </button>
                          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" />
                      </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                       className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Website</label>
                                <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
                                       className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Bio</label>
                                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                                       className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100" rows={4}/>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 bg-white dark:bg-black rounded-lg border border-gray-200 dark:border-gray-800">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Social Profiles</h3>
                        <div className="space-y-4">
                            {/* Instagram */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Instagram Handle</label>
                                    <input type="text" placeholder="@username" value={instagram} onChange={(e) => setInstagram(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Followers</label>
                                    <input type="number" placeholder="e.g. 12500" value={instagramFollowers} onChange={(e) => setInstagramFollowers(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                            </div>
                            {/* TikTok */}
                             <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">TikTok Handle</label>
                                    <input type="text" placeholder="@username" value={tiktok} onChange={(e) => setTiktok(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Followers</label>
                                    <input type="number" placeholder="e.g. 50000" value={tiktokFollowers} onChange={(e) => setTiktokFollowers(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                            </div>
                             {/* YouTube */}
                             <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">YouTube Handle</label>
                                    <input type="text" placeholder="@handle" value={youtube} onChange={(e) => setYoutube(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Subscribers</label>
                                    <input type="number" placeholder="e.g. 1000" value={youtubeFollowers} onChange={(e) => setYoutubeFollowers(e.target.value)}
                                           className="mt-1 block w-full p-2 bg-gray-100 dark:bg-gray-800 rounded-md border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-900 dark:text-gray-100"/>
                                </div>
                            </div>
                        </div>
                    </div>

                     {error && <p className="text-center text-red-500 mt-4">{error}</p>}
                </div>
            </main>
        </div>
    );
};

export default EditProfileScreen;