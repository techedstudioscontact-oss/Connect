

import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Campaign } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { fetchUsersForItems } from '../utils/firebaseUtils';
import { ArrowLeftIcon, ChatBubbleOvalLeftIcon } from '../components/icons';

interface ApplicantsScreenProps {
    campaignId: string;
    campaignTitle: string;
    onBack: () => void;
    onViewProfile: (user: UserProfile) => void;
    onStartChat: (recipient: UserProfile) => void;
}

const ApplicantsScreen: React.FC<ApplicantsScreenProps> = ({ campaignId, campaignTitle, onBack, onViewProfile, onStartChat }) => {
    const [applicants, setApplicants] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchApplicants = async () => {
            setLoading(true);
            try {
                const campaignRef = doc(db, 'campaigns', campaignId);
                const campaignSnap = await getDoc(campaignRef);

                if (campaignSnap.exists()) {
                    const campaignData = campaignSnap.data() as Campaign;
                    const applicantIds = campaignData.applicants || [];

                    if (applicantIds.length > 0) {
                        // The fetchUsersForItems utility expects an array of objects with the ID key.
                        // So we create a temporary array for it.
                        const tempItems: { applicantId: string; user?: UserProfile }[] = applicantIds.map(id => ({ applicantId: id }));
                        const applicantsWithProfiles = await fetchUsersForItems(tempItems, 'applicantId', 'user');
                        const profiles = applicantsWithProfiles.map(item => item.user).filter(Boolean) as UserProfile[];
                        setApplicants(profiles);
                    } else {
                        setApplicants([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching applicants:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchApplicants();
    }, [campaignId]);

    const formatFollowers = (num: unknown) => {
        const parsedNum = Number(num);
        if (!parsedNum || isNaN(parsedNum)) return '0';
        if (parsedNum < 10000) return parsedNum.toLocaleString();
        if (parsedNum < 1000000) return `${(parsedNum / 1000).toFixed(1)}K`;
        return `${(parsedNum / 1000000).toFixed(1)}M`;
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black">
            <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg z-10 p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-4">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="font-bold text-lg text-gray-900 dark:text-gray-100">Applicants</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{campaignTitle}</p>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full p-8">
                        <LoadingSpinner />
                    </div>
                ) : applicants.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <h2 className="font-semibold text-lg">No Applicants Yet</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Check back later to see who has applied.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-800">
                        {applicants.map(applicant => {
                            // Sum up follower counts from different social platforms.
                            // FIX: Replaced unreliable reduce with direct, type-safe summation to fix TS error.
                            const totalFollowers = (applicant.followerCounts?.instagram || 0) + (applicant.followerCounts?.tiktok || 0) + (applicant.followerCounts?.youtube || 0);
                            return (
                                <div key={applicant.uid} className="p-4 flex items-center space-x-4">
                                    <img
                                        src={applicant.avatar}
                                        alt={applicant.name}
                                        className="w-12 h-12 rounded-full cursor-pointer"
                                        onClick={() => onViewProfile(applicant)}
                                    />
                                    <div className="flex-grow cursor-pointer" onClick={() => onViewProfile(applicant)}>
                                        <p className="font-semibold text-gray-900 dark:text-gray-100">{applicant.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {totalFollowers > 0 ? `${formatFollowers(totalFollowers)} followers` : 'Influencer'}
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => onStartChat(applicant)}
                                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <ChatBubbleOvalLeftIcon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ApplicantsScreen;