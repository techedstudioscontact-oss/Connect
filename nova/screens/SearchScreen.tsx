

import React, { useState, useEffect, useMemo } from 'react';
import { SearchIcon } from '../components/icons';
import { collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Post, Campaign } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { motion } from 'framer-motion';
import { useAuth } from '../App';

interface SearchScreenProps {
    onViewProfile: (user: UserProfile) => void;
}

type SearchType = 'users' | 'posts' | 'campaigns';

const SearchScreen: React.FC<SearchScreenProps> = ({ onViewProfile }) => {
    const { userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<SearchType>('users');
    const [results, setResults] = useState<(UserProfile | Post | Campaign)[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        const performSearch = async () => {
            if (searchTerm.trim().length < 2) {
                setResults([]);
                setSearched(false);
                return;
            }
            setLoading(true);
            setSearched(true);

            try {
                let q;
                switch(searchType) {
                    case 'users':
                        q = query(
                            collection(db, 'users'),
                            where('name', '>=', searchTerm),
                            where('name', '<=', searchTerm + '\uf8ff'),
                            limit(20)
                        );
                        break;
                    case 'posts':
                        q = query(
                            collection(db, 'posts'),
                            where('caption', '>=', searchTerm),
                            where('caption', '<=', searchTerm + '\uf8ff'),
                            orderBy('caption'),
                            limit(20)
                        );
                        break;
                    case 'campaigns':
                         q = query(
                            collection(db, 'campaigns'),
                            where('title', '>=', searchTerm),
                            where('title', '<=', searchTerm + '\uf8ff'),
                            orderBy('title'),
                            limit(20)
                        );
                        break;
                }
                const querySnapshot = await getDocs(q);
                let searchResults = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
                
                // Filter Blocked Users
                const blocked = userProfile?.blockedUsers || [];
                searchResults = searchResults.filter(item => {
                    if (searchType === 'users') {
                        return !blocked.includes(item.uid);
                    } else if (searchType === 'posts') {
                        return !blocked.includes(item.userId);
                    } else if (searchType === 'campaigns') {
                        return !blocked.includes(item.brandId);
                    }
                    return true;
                });

                if (searchType === 'posts' || searchType === 'campaigns') {
                    searchResults.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                }

                setResults(searchResults);
            } catch (error) {
                console.error("Error searching:", error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            performSearch();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchTerm, searchType, userProfile?.blockedUsers]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };
    
    const renderResults = () => {
        if (loading) {
            return <div className="flex justify-center"><LoadingSpinner /></div>
        }
        if (searched && results.length === 0) {
            return <p className="text-center text-gray-500">No {searchType} found.</p>
        }
        if (results.length > 0) {
            return (
                <div className="space-y-4">
                    {results.map(item => {
                         if (searchType === 'users') {
                            const user = item as UserProfile;
                            return (
                                <div key={user.uid} onClick={() => onViewProfile(user)} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                    <img loading="lazy" src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
                                    <div>
                                        <p className="font-semibold">{user.name}</p>
                                        <p className="text-sm text-gray-500 capitalize">{user.role}</p>
                                    </div>
                                </div>
                            )
                        }
                        if (searchType === 'posts') {
                            const post = item as Post;
                            return (
                                <div key={post.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                    <img loading="lazy" src={post.mediaUrl} alt="post" className="w-12 h-12 rounded-md object-cover"/>
                                    <p className="text-sm truncate">{post.caption}</p>
                                </div>
                            )
                        }
                         if (searchType === 'campaigns') {
                            const campaign = item as Campaign;
                            return (
                                <div key={campaign.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-lg">
                                        {campaign.title.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold">{campaign.title}</p>
                                        <p className="text-sm text-gray-500">${campaign.budget.toLocaleString()}</p>
                                    </div>
                                </div>
                            )
                        }
                        return null;
                    })}
                </div>
            )
        }
        return (
             <div className="mt-6">
                 <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-400">Explore Content</h2>
                <div className="grid grid-cols-3 gap-1 mt-2">
                    {Array.from({length: 15}).map((_, i) => (
                        <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700">
                             <img loading="lazy" src={`https://picsum.photos/300/300?random=${i}`} className="w-full h-full object-cover" alt="explore content" />
                        </div>
                    ))}
                </div>
            </div>
        )
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Search</h1>
            <div className="relative">
                <input
                    type="text"
                    placeholder={`Search for ${searchType}...`}
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border rounded-full bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>

            <div className="my-4 flex justify-center space-x-2 border-b border-gray-200 dark:border-gray-800">
                {(['users', 'posts', 'campaigns'] as SearchType[]).map(type => (
                    <button key={type} onClick={() => setSearchType(type)} className={`capitalize px-4 py-2 text-sm font-semibold relative ${searchType === type ? 'text-sky-500' : 'text-gray-500'}`}>
                        {type}
                        {searchType === type && <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" layoutId="underline" />}
                    </button>
                ))}
            </div>

            <div className="mt-6">
                {renderResults()}
            </div>
        </div>
    );
};

export default SearchScreen;
