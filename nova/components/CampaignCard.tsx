import React, { useState, useRef, useEffect } from 'react';
import { Campaign, Role, NotificationType } from '../types';
import { BookmarkIcon, UsersIcon, BookmarkIconFilled, EllipsisHorizontalIcon, TrashIcon, ShareIcon } from './icons';
import { useAuth } from '../App';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { LoadingSpinner } from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

interface CampaignCardProps {
    campaign: Campaign;
    onViewApplicants?: (campaignId: string, campaignTitle: string) => void;
    onDelete?: (campaignId: string) => void;
    onShare?: (campaignId: string, campaignTitle: string) => void;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onViewApplicants, onDelete, onShare }) => {
  const { user, userProfile } = useAuth();
  const [isApplying, setIsApplying] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSaved = userProfile?.savedCampaigns?.includes(campaign.id) ?? false;
  const isInfluencer = userProfile?.role === Role.INFLUENCER;
  const hasApplied = campaign.applicants?.includes(userProfile?.uid || '');
  const isBrandOwner = userProfile?.uid === campaign.brandId;

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

  const handleSave = async () => {
    if (!user || !userProfile) return;
    const userRef = doc(db, 'users', user.uid);
    if (isSaved) {
        await updateDoc(userRef, { savedCampaigns: arrayRemove(campaign.id) });
    } else {
        await updateDoc(userRef, { savedCampaigns: arrayUnion(campaign.id) });
    }
  };

  const handleApply = async () => {
    if (!user || !userProfile || !isInfluencer || hasApplied || isApplying) return;
    
    setIsApplying(true);
    try {
        const campaignRef = doc(db, 'campaigns', campaign.id);
        await updateDoc(campaignRef, {
            applicants: arrayUnion(user.uid)
        });

        await addDoc(collection(db, 'notifications'), {
            recipientId: campaign.brandId,
            senderId: user.uid,
            type: NotificationType.CAMPAIGN_UPDATE,
            entityId: campaign.id,
            message: `applied to your campaign "${campaign.title}".`,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error applying to campaign:", error);
        alert("There was an error applying to the campaign. Please try again.");
    } finally {
        setIsApplying(false);
    }
  };

  const handleDeleteClick = () => {
    setIsMenuOpen(false);
    onDelete?.(campaign.id);
  }

  const handleShareClick = () => {
    setIsMenuOpen(false);
    onShare?.(campaign.id, campaign.title);
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-grow">
          <p className="text-xs uppercase font-semibold tracking-wider text-sky-600 dark:text-sky-400 mb-2 inline-block">{campaign.category}</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.title}</h2>
          <div className="flex items-center space-x-2 mt-2 text-gray-600 dark:text-gray-400">
             <img loading="lazy" src={campaign.brand?.avatar || `https://i.pravatar.cc/150?u=${campaign.brandId}`} alt="brand" className="w-6 h-6 rounded-full object-cover" />
             <span className="text-sm font-medium">{campaign.brand?.name || 'A Brand'}</span>
          </div>
        </div>
        <div className="flex items-center space-x-0">
            <button onClick={handleSave} aria-label={isSaved ? 'Unsave campaign' : 'Save campaign'} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 p-2 rounded-full transition-colors">
                {isSaved ? <BookmarkIconFilled className="h-6 w-6"/> : <BookmarkIcon className="h-6 w-6"/>}
            </button>
            {isBrandOwner && (onDelete || onShare) && (
                <div className="relative">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="More options" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <EllipsisHorizontalIcon className="h-6 w-6 text-gray-500" />
                    </button>
                    <AnimatePresence>
                        {isMenuOpen && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.1 }}
                                className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 origin-top-right"
                            >
                                <ul className="p-1">
                                    {onShare && <li><button onClick={handleShareClick} className="w-full text-left rounded-md px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"><ShareIcon className="h-4 w-4" /><span>Share</span></button></li>}
                                    {onDelete && <li><button onClick={handleDeleteClick} className="w-full text-left rounded-md px-3 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"><TrashIcon className="h-4 w-4" /><span>Delete</span></button></li>}
                                </ul>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
      </div>
      <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">{campaign.description}</p>
      <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 -m-5 mt-5 border-t border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm text-gray-500">Budget</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-white">${campaign.budget.toLocaleString()}</p>
        </div>
        {isBrandOwner && onViewApplicants ? (
            <button
                onClick={() => onViewApplicants(campaign.id, campaign.title)}
                className="flex items-center justify-center space-x-2 bg-indigo-500 text-white font-bold py-2 px-5 rounded-full min-w-[130px] h-[40px] hover:bg-indigo-600 transition-all transform hover:scale-105"
            >
                <UsersIcon className="h-5 w-5" />
                <span>View ({campaign.applicants?.length || 0})</span>
            </button>
        ) : isInfluencer ? (
            <button 
                onClick={handleApply}
                disabled={hasApplied || isApplying}
                className="flex items-center justify-center space-x-2 bg-sky-500 text-white font-bold py-2 px-5 rounded-full min-w-[130px] h-[40px] hover:bg-sky-600 transition-all transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed disabled:scale-100"
            >
                {isApplying ? (
                    <LoadingSpinner size="sm" />
                ) : hasApplied ? (
                    'Applied'
                ) : (
                    <>
                        <span>Apply Now</span>
                    </>
                )}
            </button>
        ) : null}
      </div>
    </div>
  );
};

export default CampaignCard;