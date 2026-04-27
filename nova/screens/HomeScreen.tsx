

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, Timestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Campaign, Story, UserProfile } from '../types';
import PostCard from '../components/PostCard';
import CampaignCard from '../components/CampaignCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useAuth } from '../App';
import { fetchUsersForItems } from '../utils/firebaseUtils';
import { motion } from 'framer-motion';
import { FullScreenIcon, RefreshIcon } from '../components/icons';

const StoryBubble: React.FC<{ story: Story }> = ({ story }) => (
    <div className="flex-shrink-0 flex flex-col items-center space-y-1.5 cursor-pointer group">
        <div className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 p-0.5 rounded-full group-hover:scale-105 transition-transform duration-200">
            <div className="bg-white dark:bg-black p-0.5 rounded-full">
                <img loading="lazy" src={story.user?.avatar || `https://i.pravatar.cc/150?u=${story.userId}`} alt="story" className="w-16 h-16 rounded-full object-cover" />
            </div>
        </div>
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate w-20 text-center">{story.user?.name}</p>
    </div>
)

const FilterButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200 focus:outline-none relative ${
      isActive
        ? 'bg-sky-500 text-white shadow-md'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`}
  >
    {label}
  </button>
);

const PostSkeleton = () => (
    <div className="bg-white dark:bg-black">
        <div className="p-3 animate-pulse">
            <div className="flex items-center space-x-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-800"></div>
                <div className="flex-grow space-y-2">
                    <div className="w-24 h-4 rounded bg-gray-200 dark:bg-gray-800"></div>
                </div>
            </div>
            <div className="w-full aspect-square bg-gray-200 dark:bg-gray-800 rounded-md"></div>
            <div className="mt-3 space-y-2">
                <div className="w-1/4 h-4 rounded bg-gray-200 dark:bg-gray-800"></div>
                <div className="w-full h-4 rounded bg-gray-200 dark:bg-gray-800"></div>
                <div className="w-1/2 h-4 rounded bg-gray-200 dark:bg-gray-800"></div>
            </div>
        </div>
    </div>
);

const AdCard = () => (
    <div className="p-4 m-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">Sponsored</p>
        <div className="flex items-center space-x-4 mt-2">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
               <img src="https://storage.googleapis.com/aistudio-marketplace-enterprise-assets/assets/ad-placeholder.png" alt="Ad placeholder" className="w-full h-full object-cover rounded-lg"/>
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Your Next Favorite Brand</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Discover amazing products and services tailored for you.</p>
                <button className="mt-3 text-sm font-semibold text-sky-600 dark:text-sky-400">Learn More</button>
            </div>
        </div>
    </div>
);


const HomeScreen: React.FC<{ 
    onStartChat: (recipient: UserProfile) => void;
    onViewProfile: (user: UserProfile) => void;
    onViewApplicants: (campaignId: string, campaignTitle: string) => void;
}> = ({ onStartChat, onViewProfile, onViewApplicants }) => {
    const { userProfile } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<'all' | 'posts' | 'campaigns'>('all');
    
    // Filter out content from blocked users
    const filterBlocked = <T extends { userId?: string, brandId?: string }>(items: T[]) => {
        const blocked = userProfile?.blockedUsers || [];
        return items.filter(item => {
            const uid = item.userId || item.brandId;
            return uid && !blocked.includes(uid);
        });
    };

    const feed = useMemo(() => {
        const combined = [...posts, ...campaigns];
        const filtered = filterBlocked(combined);
        return filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }, [posts, campaigns, userProfile?.blockedUsers]);

    const displayStories = useMemo(() => {
        return filterBlocked(stories);
    }, [stories, userProfile?.blockedUsers]);

    useEffect(() => {
        if (!userProfile?.uid) return;

        setLoading(true);
        const following = userProfile.following && Array.isArray(userProfile.following) ? userProfile.following : [];
        
        const postsQuery = following.length > 0
            ? query(collection(db, 'posts'), where('userId', 'in', following.slice(0, 30)))
            : query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10));

        const unsubPosts = onSnapshot(postsQuery, async (snapshot) => {
            // If the user is following people but their feed is empty, show community posts as a fallback.
            if (snapshot.empty && following.length > 0) {
                // We use getDocs for a one-time fetch. The original listener remains active.
                // If a followed user posts, this component will re-render and show their post.
                const communityPostsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(10));
                const communitySnapshot = await getDocs(communityPostsQuery);
                const postsData = communitySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
                const postsWithUsers = await fetchUsersForItems(postsData, 'userId', 'user');
                setPosts(postsWithUsers as Post[]);
            } else {
                // Original logic for when not following, or when the following feed has content.
                const postsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post));
                const postsWithUsers = await fetchUsersForItems(postsData, 'userId', 'user');
                setPosts(postsWithUsers as Post[]);
            }
            setLoading(false); // Main content is loaded
        }, (error) => {
            console.error("Post listener error:", error);
            setLoading(false);
        });
        
        const campaignsQuery = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'), limit(10));
        const unsubCampaigns = onSnapshot(campaignsQuery, async (snapshot) => {
            const campaignsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
            const campaignsWithBrands = await fetchUsersForItems(campaignsData, 'brandId', 'brand');
            setCampaigns(campaignsWithBrands as Campaign[]);
        }, (error) => console.error("Campaign listener error:", error));
        
        const storiesQuery = query(collection(db, 'stories'), where('expiresAt', '>', Timestamp.now()), orderBy('expiresAt', 'desc'), limit(15));
        const unsubStories = onSnapshot(storiesQuery, async (snapshot) => {
            const storiesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Story));
            const storiesWithUsers = await fetchUsersForItems(storiesData, 'userId', 'user');
            setStories(storiesWithUsers as Story[]);
        }, (error) => console.error("Stories listener error:", error));

        return () => {
            unsubPosts();
            unsubCampaigns();
            unsubStories();
        };
    }, [userProfile]);

    const isFollowingAnyone = userProfile?.following && Array.isArray(userProfile.following) && userProfile.following.length > 0;

    const filteredFeed = useMemo(() => {
        if (activeFilter === 'posts') {
            return feed.filter(item => 'userId' in item);
        }
        if (activeFilter === 'campaigns') {
            return feed.filter(item => 'brandId' in item);
        }
        return feed;
    }, [feed, activeFilter]);

    const feedWithAds = useMemo(() => {
        const items: (Post | Campaign | { id: string; type: 'ad' })[] = [...filteredFeed];
        // Insert an ad after the 2nd item, if there are enough items.
        if (items.length > 2) {
          items.splice(2, 0, { id: 'ad-1', type: 'ad' });
        }
        return items;
    }, [filteredFeed]);

    return (
        <div className="w-full h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                 <h1 className="text-3xl font-wordmark italic font-bold text-gray-800 dark:text-gray-100">CollabSea</h1>
                 <div className="flex items-center space-x-2">
                    <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                        <FullScreenIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
                        <RefreshIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                </div>
            </header>
            
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex space-x-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    {displayStories.map(story => <StoryBubble key={story.id} story={story} />)}
                </div>
            </div>

            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-center space-x-2">
                    <FilterButton label="All" isActive={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
                    <FilterButton label="Posts" isActive={activeFilter === 'posts'} onClick={() => setActiveFilter('posts')} />
                    <FilterButton label="Campaigns" isActive={activeFilter === 'campaigns'} onClick={() => setActiveFilter('campaigns')} />
                </div>
            </div>
            
            {!loading && !isFollowingAnyone && (
                 <div className="p-4 m-4 bg-sky-50 dark:bg-gray-800 rounded-lg border border-sky-200 dark:border-gray-700 text-center">
                    <h3 className="font-semibold text-sky-800 dark:text-sky-200">Welcome to Your Feed!</h3>
                    <p className="text-sm text-sky-600 dark:text-sky-300 mt-1">Follow creators and brands to see their content here. For now, here are some recent posts from the community.</p>
                </div>
            )}

            {loading ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    <PostSkeleton />
                    <PostSkeleton />
                    <PostSkeleton />
                </div>
            ) : feedWithAds.length > 0 ? (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {feedWithAds.map(item => {
                        if ('type' in item && item.type === 'ad') {
                            return <AdCard key={item.id} />;
                        } else if ('userId' in item) {
                            return (
                                <motion.div key={`post-${item.id}`} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}}>
                                    <PostCard post={item as Post} onStartChat={onStartChat} onViewProfile={onViewProfile} />
                                </motion.div>
                            );
                        } else if ('brandId' in item) {
                            return (
                                <motion.div key={`campaign-${item.id}`} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.5}} className="py-4 px-2 md:px-0">
                                    <CampaignCard campaign={item as Campaign} onViewApplicants={onViewApplicants} />
                                </motion.div>
                            );
                        }
                        return null;
                    })}
                </div>
            ) : (
                 <div className="text-center py-16">
                    <p className="text-gray-500 dark:text-gray-400">Your feed is empty.</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Follow people to see their posts here.</p>
                </div>
            )}
        </div>
    );
};

export default HomeScreen;
