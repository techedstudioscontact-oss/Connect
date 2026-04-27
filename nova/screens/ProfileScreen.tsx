

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc, orderBy, documentId, getCountFromServer } from 'firebase/firestore';
import { GearIcon, GridIcon, BookmarkIcon, ArrowLeftIcon, HeartIcon, ChatBubbleOvalLeftIcon, MegaphoneIcon, InstagramIcon, TikTokIcon, YouTubeIcon, EllipsisHorizontalIcon, NoSymbolIcon, CheckBadgeIcon, ShareIcon, SparklesIcon } from '../components/icons';
import { UserProfile, NotificationType, Post, Campaign, Role } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsersForItems } from '../utils/firebaseUtils';
import CampaignCard from '../components/CampaignCard';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileScreenProps {
    userIdToView?: string;
    onNavigateToEditProfile?: () => void;
    onNavigateToSettings?: () => void;
    onBack?: () => void;
    onStartChat: (recipient: UserProfile) => void;
    onViewApplicants?: (campaignId: string, campaignTitle: string) => void;
    onViewFollowers?: (userId: string) => void;
    onViewFollowing?: (userId: string) => void;
    onAnalyzeProfile?: (prompt: string) => void;
}

// Helper to fetch documents in chunks for Firestore 'in' query
const fetchDocsInChunks = async <T,>(collectionName: string, ids: string[]): Promise<T[]> => {
    if (ids.length === 0) return [];
    const results: T[] = [];
    const chunkSize = 30; // Firestore 'in' query limit
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        if (chunk.length > 0) {
            const q = query(collection(db, collectionName), where(documentId(), 'in', chunk));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                results.push({ id: doc.id, ...doc.data() } as T);
            });
        }
    }
    return results;
};


const ProfileScreen: React.FC<ProfileScreenProps> = ({ userIdToView, onNavigateToEditProfile, onNavigateToSettings, onBack, onStartChat, onViewApplicants, onViewFollowers, onViewFollowing, onAnalyzeProfile }) => {
    const { user, userProfile: currentUserProfile } = useAuth();
    const [profileData, setProfileData] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [postCount, setPostCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);
    const [savedContent, setSavedContent] = useState<(Post | Campaign)[]>([]);
    const [likedPosts, setLikedPosts] = useState<Post[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingContent, setLoadingContent] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'posts' | 'campaigns' | 'saved' | 'likes'>('posts');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const profileToView = userIdToView ? profileData : currentUserProfile;
    const isCurrentUserProfile = !userIdToView || userIdToView === currentUserProfile?.uid;
    
    // Blocking Logic
    const isBlocked = currentUserProfile?.blockedUsers?.includes(profileToView?.uid || '');

    const formatFollowers = (num: unknown) => {
        const parsedNum = Number(num);
        if (!parsedNum || isNaN(parsedNum)) return '0';
        if (parsedNum < 10000) return parsedNum.toLocaleString();
        if (parsedNum < 1000000) return `${(parsedNum / 1000).toFixed(1)}K`;
        return `${(parsedNum / 1000000).toFixed(1)}M`;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const profileUid = userIdToView || currentUserProfile?.uid;
        if (!profileUid) {
             setLoadingProfile(false);
             return;
        }

        setLoadingProfile(true);
        const userDocRef = doc(db, 'users', profileUid);
        const unsubscribe = onSnapshot(userDocRef, (doc) => {
            if (doc.exists()) {
                setProfileData({ uid: doc.id, ...doc.data() } as UserProfile);
            } else {
                setProfileData(null);
            }
            setLoadingProfile(false);
        }, (error) => {
            console.error("Error fetching user profile:", error);
            setLoadingProfile(false);
        });
        
        // Fetch internal follower count
        const fetchFollowerCount = async () => {
            try {
                const q = query(collection(db, 'users'), where('following', 'array-contains', profileUid));
                const snapshot = await getCountFromServer(q);
                setFollowerCount(snapshot.data().count);
            } catch (error) {
                console.error("Error fetching follower count:", error);
            }
        };
        fetchFollowerCount();

        return () => unsubscribe();
        
    }, [userIdToView, currentUserProfile]);

    // Effect to keep post count updated in real-time for the stats display
    useEffect(() => {
        const profileUid = userIdToView || currentUserProfile?.uid;
        if (!profileUid) {
            setPostCount(0);
            return;
        }
        
        const q = query(collection(db, 'posts'), where('userId', '==', profileUid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPostCount(snapshot.size);
        }, (error) => {
            console.error("Error fetching post count:", error);
        });
        
        return () => unsubscribe();
    }, [userIdToView, currentUserProfile]);
    
    useEffect(() => {
        const profileUid = profileToView?.uid;
        if (!profileUid) return;
        
        // If blocked, don't fetch content
        if (isBlocked) {
            setLoadingContent(false);
            return;
        }

        setLoadingContent(true);
        setPosts([]);
        setSavedContent([]);
        setLikedPosts([]);
        setCampaigns([]);

        if (activeTab === 'posts') {
            const postsQuery = query(collection(db, 'posts'), where('userId', '==', profileUid));
            const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
                const userPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
                // Sort by createdAt descending client-side
                userPosts.sort((a, b) => {
                    const tA = a.createdAt?.toMillis() || 0;
                    const tB = b.createdAt?.toMillis() || 0;
                    return tB - tA;
                });
                setPosts(userPosts);
                setLoadingContent(false);
            }, (error) => {
                console.error("Error fetching user posts:", error);
                setLoadingContent(false);
            });
            return unsubscribe;
        } else if (activeTab === 'campaigns') {
            let campaignsQuery;
            if (profileToView.role === Role.BRAND) {
                campaignsQuery = query(collection(db, 'campaigns'), where('brandId', '==', profileUid));
            } else { // Influencer
                campaignsQuery = query(collection(db, 'campaigns'), where('applicants', 'array-contains', profileUid));
            }
            
            const unsubscribe = onSnapshot(campaignsQuery, async (snapshot) => {
                const userCampaignsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
                userCampaignsData.sort((a, b) => {
                    const tA = a.createdAt?.toMillis() || 0;
                    const tB = b.createdAt?.toMillis() || 0;
                    return tB - tA;
                });
                const campaignsWithBrands = await fetchUsersForItems(userCampaignsData, 'brandId', 'brand');
                setCampaigns(campaignsWithBrands as Campaign[]);
                setLoadingContent(false);
            }, (error) => { 
                console.error("Error fetching campaigns:", error);
                setLoadingContent(false);
            });
            return unsubscribe;
        } else if (activeTab === 'saved' && isCurrentUserProfile) {
            const fetchSavedContent = async () => {
                try {
                    const savedPostIds = profileToView.savedPosts || [];
                    const savedCampaignIds = profileToView.savedCampaigns || [];
                    
                    const [fetchedPosts, fetchedCampaigns] = await Promise.all([
                        fetchDocsInChunks<Post>('posts', savedPostIds),
                        fetchDocsInChunks<Campaign>('campaigns', savedCampaignIds),
                    ]);

                    const fetchedContent = [...fetchedPosts, ...fetchedCampaigns];
                    
                    fetchedContent.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                    setSavedContent(fetchedContent);
                } catch (error) {
                    console.error("Error fetching saved content:", error);
                } finally {
                    setLoadingContent(false);
                }
            };
            fetchSavedContent();
        } else if (activeTab === 'likes' && isCurrentUserProfile) {
             const fetchLikedPosts = async () => {
                try {
                    const likedPostIds = profileToView.likedPosts || [];
                    const fetchedPosts = await fetchDocsInChunks<Post>('posts', likedPostIds);
                    fetchedPosts.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                    setLikedPosts(fetchedPosts);
                } catch (error) {
                    console.error("Error fetching liked content:", error);
                } finally {
                    setLoadingContent(false);
                }
            };
            fetchLikedPosts();
        }
        else {
            setLoadingContent(false);
        }
    }, [profileToView, activeTab, isCurrentUserProfile, isBlocked]);

    const isFollowing = Array.isArray(currentUserProfile?.following) && currentUserProfile.following.includes(profileToView?.uid || '');
    
    const handleFollowToggle = async () => {
        if (!user || !currentUserProfile || isCurrentUserProfile || !profileToView) return;
        setIsSubmitting(true);

        const currentUserRef = doc(db, 'users', user.uid);

        try {
            if (isFollowing) {
                await updateDoc(currentUserRef, { following: arrayRemove(profileToView.uid) });
                setFollowerCount(prev => Math.max(0, prev - 1));
            } else {
                await updateDoc(currentUserRef, { following: arrayUnion(profileToView.uid) });
                setFollowerCount(prev => prev + 1);
                
                await addDoc(collection(db, 'notifications'), {
                    recipientId: profileToView.uid,
                    senderId: user.uid,
                    type: NotificationType.NEW_FOLLOWER,
                    entityId: user.uid,
                    message: `started following you.`,
                    read: false,
                    createdAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Failed to follow/unfollow:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBlockToggle = async () => {
        if (!user || !currentUserProfile || !profileToView || isCurrentUserProfile) return;
        setIsMenuOpen(false);
        const confirmMsg = isBlocked 
            ? `Unblock ${profileToView.name}?` 
            : `Block ${profileToView.name}? They won't be able to interact with you, and you won't see their content.`;
        
        if (window.confirm(confirmMsg)) {
            try {
                const currentUserRef = doc(db, 'users', user.uid);
                if (isBlocked) {
                    await updateDoc(currentUserRef, { blockedUsers: arrayRemove(profileToView.uid) });
                } else {
                    await updateDoc(currentUserRef, { 
                        blockedUsers: arrayUnion(profileToView.uid),
                        following: arrayRemove(profileToView.uid) // Unfollow if blocking
                    });
                }
            } catch (e) {
                console.error("Error toggling block:", e);
                alert("Action failed. Please try again.");
            }
        }
    }

    const handleDeleteCampaign = async (campaignId: string) => {
        if (!campaignId) return;
        if (window.confirm('Are you sure you want to delete this campaign? This action is permanent.')) {
            const originalCampaigns = [...campaigns];
            const campaignToDelete = originalCampaigns.find(c => c.id === campaignId);
            setCampaigns(prevCampaigns => prevCampaigns.filter(c => c.id !== campaignId));
            try {
                await deleteDoc(doc(db, 'campaigns', campaignId));
            } catch (error) {
                console.error("Error deleting campaign:", error);
                alert("Failed to delete the campaign. Please try again.");
                if (campaignToDelete) setCampaigns(originalCampaigns);
            }
        }
    };

    const handleShareCampaign = (campaignId: string, title: string) => {
        const campaignUrl = `${window.location.origin}/campaign/${campaignId}`;
        if (navigator.share) {
            navigator.share({
                title: `Check out this campaign on CollabSea: ${title}`,
                url: campaignUrl,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(campaignUrl)
                .then(() => alert('Campaign link copied to clipboard!'))
                .catch(err => alert('Failed to copy link.'));
        }
    };
    
    const handleShareProfile = () => {
        if (!profileToView) return;
        const profileUrl = `${window.location.origin}/profile/${profileToView.uid}`;
        if (navigator.share) {
            navigator.share({
                title: `Check out ${profileToView.name}'s profile on CollabSea!`,
                url: profileUrl,
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(profileUrl)
                .then(() => alert('Profile link copied to clipboard!'))
                .catch(err => alert('Failed to copy link.'));
        }
    };
    
    const triggerAnalysis = () => {
        if (!profileToView || !onAnalyzeProfile) return;
        
        // Gather stats
        let totalLikes = 0;
        let maxLikes = 0;
        let avgLikes = 0;
        let postsCount = posts.length;
        
        posts.forEach(p => {
            const count = (p.likes || []).length;
            totalLikes += count;
            if (count > maxLikes) maxLikes = count;
        });
        
        if (postsCount > 0) {
            avgLikes = Math.round(totalLikes / postsCount);
        }
        
        const prompt = `Act as a Brand Safety & Influencer Marketing Auditor for CollabSea. Perform a comprehensive analysis on this ${profileToView.role} profile.

**Profile Data:**
- Name: ${profileToView.name}
- Role: ${profileToView.role}
- Bio: ${profileToView.bio || "N/A"}
- Followers (Internal): ${followerCount}
- Verified: ${profileToView.isVerified ? "Yes" : "No"}

**Content & Engagement Metrics (Based on recent fetched posts):**
- Total Posts Analyzed: ${postsCount}
- Average Likes per Post: ${avgLikes}
- Highest Liked Post (Peak Engagement): ${maxLikes} likes
- Estimated Views (Projection based on 10% like-to-view ratio): ~${avgLikes * 10} views per post
- Recent Content Types: ${posts.map(p => p.mediaType).join(', ').slice(0, 50)}...

**Required Output:**
Please generate a structured, professional report containing:

1.  **Safety & Credibility Audit:** Are there red flags? Is the account safe to collaborate with?
2.  **AI Portfolio Summary:** Describe their content niche, style, and probable audience demographics based on the bio and stats.
3.  **Performance Deep Dive:** Analyze the engagement. Is it consistent? Viral? Low?
4.  **CollabSea Score:** Give a strict score out of 10 based on potential ROI, safety, and reach. Provide 3 bullet points justifying the score.

Format the response using Markdown with bold headers and bullet points.`;

        onAnalyzeProfile(prompt);
    };

    const renderWebsite = (url: string) => {
        let displayUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '');
        const fullUrl = url.startsWith('http') ? url : `https://${url}`;
        return <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 font-semibold text-sm">{displayUrl}</a>
    }

    if (loadingProfile) {
        return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
    }

    if (!profileToView) {
        return <div className="flex flex-col justify-center items-center h-screen"><p>Profile not found.</p>{onBack && <button onClick={onBack} className="mt-4 text-sky-500">Go Back</button>}</div>;
    }
    
    const StatItem = ({ value, label, onClick }: { value: number | string; label: string; onClick?: () => void }) => (
        <button disabled={!onClick || !!isBlocked} onClick={onClick} className="text-center disabled:cursor-default p-1 hover:opacity-80 transition-opacity">
            <p className="font-bold text-lg">{value}</p>
            <p className="text-gray-500 text-sm">{label}</p>
        </button>
    );
    
    const hasSocials = profileToView.socials && (profileToView.socials.instagram || profileToView.socials.tiktok || profileToView.socials.youtube);

    return (
        <div className="bg-white dark:bg-black min-h-full">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 flex justify-between items-center p-4 h-16 border-b border-gray-200 dark:border-gray-800">
                 <div className="flex items-center space-x-2">
                    {!isCurrentUserProfile && onBack && (
                      <button onClick={onBack} className="text-gray-900 dark:text-gray-100 p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeftIcon className="h-5 w-5" /></button>
                    )}
                    <h1 className="text-xl font-bold flex items-center gap-1">
                        {isBlocked ? "User" : profileToView.name}
                        {profileToView.isVerified && !isBlocked && <CheckBadgeIcon className="h-4 w-4 text-blue-500" />}
                    </h1>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handleShareProfile} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <ShareIcon className="h-6 w-6" />
                    </button>
                    {isCurrentUserProfile ? (
                        <button onClick={onNavigateToSettings} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                            <GearIcon className="h-6 w-6" />
                        </button>
                    ) : (
                         <div className="relative">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                                <EllipsisHorizontalIcon className="h-6 w-6" />
                            </button>
                            <AnimatePresence>
                                {isMenuOpen && (
                                    <motion.div
                                        ref={menuRef}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.1 }}
                                        className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 origin-top-right"
                                    >
                                        <ul className="p-1">
                                            <li>
                                                <button onClick={handleBlockToggle} className="w-full text-left rounded-md px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2">
                                                    <NoSymbolIcon className="h-4 w-4" />
                                                    <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                                                </button>
                                            </li>
                                        </ul>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </header>
            
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <img loading="lazy" src={isBlocked ? `https://i.pravatar.cc/150?u=blocked` : profileToView.avatar} alt="avatar" className={`w-20 h-20 rounded-full object-cover p-0.5 border-2 ${isBlocked ? 'border-gray-300 grayscale opacity-50' : 'border-sky-400'}`} />
                    <div className="flex space-x-6">
                        <StatItem value={isBlocked ? '-' : postCount} label="Posts" />
                        <StatItem value={isBlocked ? '-' : formatFollowers(followerCount)} label="Followers" onClick={() => onViewFollowers?.(profileToView.uid)} />
                        <StatItem value={isBlocked ? '-' : (Array.isArray(profileToView.following) ? profileToView.following.length : 0)} label="Following" onClick={() => onViewFollowing?.(profileToView.uid)} />
                    </div>
                </div>
                
                <div className="mb-4">
                    <p className="font-semibold flex items-center gap-1">
                        {isBlocked ? "Blocked User" : profileToView.name}
                        {profileToView.isVerified && !isBlocked && <CheckBadgeIcon className="h-4 w-4 text-blue-500" />}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm capitalize">{profileToView.role}</p>
                    {!isBlocked && profileToView.bio && <p className="my-2 text-sm">{profileToView.bio}</p>}
                    {!isBlocked && profileToView.website && renderWebsite(profileToView.website)}
                </div>

                {!isBlocked && hasSocials && (
                    <div className="flex items-center justify-start space-x-6 my-4">
                        {profileToView.socials?.instagram && (
                            <a href={`https://instagram.com/${profileToView.socials.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400">
                                <InstagramIcon className="h-6 w-6" />
                                <span className="text-sm font-semibold">{formatFollowers(profileToView.followerCounts?.instagram)}</span>
                            </a>
                        )}
                        {profileToView.socials?.tiktok && (
                            <a href={`https://tiktok.com/@${profileToView.socials.tiktok}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400">
                                <TikTokIcon className="h-6 w-6" />
                                <span className="text-sm font-semibold">{formatFollowers(profileToView.followerCounts?.tiktok)}</span>
                            </a>
                        )}
                        {profileToView.socials?.youtube && (
                             <a href={`https://youtube.com/${profileToView.socials.youtube.startsWith('@') ? '' : 'c/'}${profileToView.socials.youtube}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-sky-500 dark:hover:text-sky-400">
                                <YouTubeIcon className="h-6 w-6" />
                                <span className="text-sm font-semibold">{formatFollowers(profileToView.followerCounts?.youtube)}</span>
                            </a>
                        )}
                    </div>
                )}
                
                {!isBlocked && (
                     <div className="flex flex-col space-y-2">
                         <div className="flex space-x-2">
                            {isCurrentUserProfile ? (
                                <button onClick={onNavigateToEditProfile} className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Edit Profile</button>
                            ) : (
                                <>
                                <button 
                                    onClick={handleFollowToggle} 
                                    disabled={!currentUserProfile || isSubmitting}
                                    className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-colors flex justify-center items-center h-10 min-w-[100px] ${
                                        isFollowing 
                                            ? 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200' 
                                            : 'bg-sky-500 text-white'
                                    } disabled:opacity-50`}
                                >
                                    {isSubmitting ? <LoadingSpinner size="sm" /> : (isFollowing ? 'Following' : 'Follow')}
                                </button>
                                <button onClick={() => onStartChat(profileToView)} className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                                    Message
                                </button>
                                </>
                            )}
                         </div>
                         
                         {/* Analyze Profile Button - Available for both self (to see how others view you) and others */}
                         <button 
                            onClick={triggerAnalysis} 
                            disabled={loadingContent}
                            className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:from-purple-600 hover:to-indigo-700 transition-all"
                         >
                             <SparklesIcon className="w-4 h-4 text-yellow-300" />
                             <span>Analyze {isCurrentUserProfile ? "My" : ""} Profile with Nova</span>
                         </button>
                    </div>
                )}
            </div>
            
            {isBlocked ? (
                <div className="p-8 text-center border-t border-gray-200 dark:border-gray-800">
                    <NoSymbolIcon className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 dark:text-gray-400 font-semibold">You have blocked this user.</p>
                    <p className="text-xs text-gray-400 mt-1">You cannot see their posts or interact with them.</p>
                    <button onClick={handleBlockToggle} className="mt-4 text-sky-500 text-sm font-semibold hover:underline">Unblock User</button>
                </div>
            ) : (
                <div className="border-t border-gray-200 dark:border-gray-800">
                    <div className="flex">
                        <button onClick={() => setActiveTab('posts')} className={`flex-1 justify-center p-3 flex items-center relative text-gray-500 dark:text-gray-400 ${activeTab === 'posts' ? 'text-gray-900 dark:text-gray-100' : ''}`}>
                            <GridIcon className="h-6 w-6"/>
                            {activeTab === 'posts' && <div className="absolute bottom-0 w-full h-0.5 bg-gray-800 dark:bg-gray-200" />}
                        </button>
                        <button onClick={() => setActiveTab('campaigns')} className={`flex-1 justify-center p-3 flex items-center relative text-gray-500 dark:text-gray-400 ${activeTab === 'campaigns' ? 'text-gray-900 dark:text-gray-100' : ''}`}>
                            <MegaphoneIcon className="h-6 w-6"/>
                            {activeTab === 'campaigns' && <div className="absolute bottom-0 w-full h-0.5 bg-gray-800 dark:bg-gray-200" />}
                        </button>
                        {isCurrentUserProfile && (
                            <>
                            <button onClick={() => setActiveTab('likes')} className={`flex-1 justify-center p-3 flex items-center relative text-gray-500 dark:text-gray-400 ${activeTab === 'likes' ? 'text-gray-900 dark:text-gray-100' : ''}`}>
                                <HeartIcon className="h-6 w-6"/>
                                {activeTab === 'likes' && <div className="absolute bottom-0 w-full h-0.5 bg-gray-800 dark:bg-gray-200" />}
                            </button>
                            <button onClick={() => setActiveTab('saved')} className={`flex-1 justify-center p-3 flex items-center relative text-gray-500 dark:text-gray-400 ${activeTab === 'saved' ? 'text-gray-900 dark:text-gray-100' : ''}`}>
                                <BookmarkIcon className="h-6 w-6"/>
                                {activeTab === 'saved' && <div className="absolute bottom-0 w-full h-0.5 bg-gray-800 dark:bg-gray-200" />}
                            </button>
                            </>
                        )}
                    </div>
                    
                    {loadingContent ? (
                        <div className="flex justify-center p-8"><LoadingSpinner /></div>
                    ) : (
                        <div>
                            {activeTab === 'posts' && (
                                posts.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-0.5">
                                        {posts.map(post => (
                                            <div key={post.id} className="aspect-square bg-gray-200 dark:bg-gray-800">
                                                {post.mediaType === 'image' ? (
                                                    <img loading="lazy" src={post.mediaUrl} className="w-full h-full object-cover" alt="user post" />
                                                ) : (
                                                    <div className="relative w-full h-full">
                                                        <video src={post.mediaUrl} className="w-full h-full object-cover bg-black" />
                                                        <div className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"><ChatBubbleOvalLeftIcon className="w-3 h-3 text-white" /></div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="col-span-3 text-center text-gray-500 py-16">No posts yet.</p>
                            )}
                            {activeTab === 'campaigns' && (
                                campaigns.length > 0 ? (
                                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                                        <AnimatePresence>
                                        {campaigns.map(campaign => (
                                            <motion.div 
                                                key={campaign.id}
                                                layout
                                                initial={{ opacity: 1 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0, height: 0, transition: { duration: 0.3 } }}
                                                transition={{ duration: 0.3, type: 'spring' }}
                                                className="py-4 px-2 md:px-0 overflow-hidden"
                                            >
                                                <CampaignCard 
                                                    campaign={campaign}
                                                    onDelete={isCurrentUserProfile && profileToView.role === Role.BRAND ? handleDeleteCampaign : undefined}
                                                    onShare={isCurrentUserProfile && profileToView.role === Role.BRAND ? handleShareCampaign : undefined}
                                                    onViewApplicants={onViewApplicants && isCurrentUserProfile && profileToView.role === Role.BRAND ? onViewApplicants : undefined}
                                                />
                                            </motion.div>
                                        ))}
                                        </AnimatePresence>
                                    </div>
                                ) : (
                                    <p className="col-span-3 text-center text-gray-500 py-16">
                                        {profileToView.role === Role.BRAND ? "No campaigns posted yet." : "No applied campaigns yet."}
                                    </p>
                                )
                            )}
                            {activeTab === 'saved' && (
                                savedContent.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-0.5">
                                        {savedContent.map(item => (
                                            <div key={item.id} className="aspect-square bg-gray-200 dark:bg-gray-800">
                                                {'mediaUrl' in item ? (
                                                    <img loading="lazy" src={(item as Post).mediaUrl} className="w-full h-full object-cover" alt="saved post" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-2 text-white font-bold text-center text-sm">
                                                        {(item as Campaign).title}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="col-span-3 text-center text-gray-500 py-16">No saved content.</p>
                            )}
                            {activeTab === 'likes' && (
                                likedPosts.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-0.5">
                                        {likedPosts.map(post => (
                                            <div key={post.id} className="aspect-square bg-gray-200 dark:bg-gray-800">
                                                {post.mediaType === 'image' ? (
                                                    <img loading="lazy" src={post.mediaUrl} className="w-full h-full object-cover" alt="liked post" />
                                                ) : (
                                                    <div className="relative w-full h-full">
                                                        <video src={post.mediaUrl} className="w-full h-full object-cover bg-black" />
                                                        <div className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"><ChatBubbleOvalLeftIcon className="w-3 h-3 text-white" /></div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="col-span-3 text-center text-gray-500 py-16">No liked posts.</p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfileScreen;