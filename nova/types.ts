import { Timestamp } from 'firebase/firestore';

export enum Role {
  INFLUENCER = 'influencer',
  BRAND = 'brand'
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: Role;
  bio?: string;
  website?: string;
  avatar?: string;
  isVerified?: boolean; // New: Verified Badge status
  socials?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
  followerCounts?: {
    instagram?: number;
    tiktok?: number;
    youtube?: number;
  };
  following?: string[];
  blockedUsers?: string[];
  likedPosts?: string[];
  savedPosts?: string[];
  savedCampaigns?: string[];
}

export interface Post {
  id: string;
  userId: string;
  user?: UserProfile;
  caption: string;
  mediaUrl: string;
  mediaPublicId?: string;
  mediaType: 'image' | 'video';
  likes: string[];
  comments: Comment[];
  createdAt: Timestamp;
}

export interface Comment {
  userId: string;
  user?: UserProfile;
  username: string;
  comment: string;
  createdAt: Timestamp;
}

export interface Campaign {
  id: string;
  brandId: string;
  brand?: UserProfile;
  title: string;
  description: string;
  budget: number;
  category: string;
  applicants: string[];
  createdAt: Timestamp;
}

export interface Story {
    id: string;
    userId: string;
    user?: UserProfile;
    mediaUrl: string;
    mediaPublicId?: string;
    expiresAt: Timestamp;
    createdAt: Timestamp;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastUpdatedAt: Timestamp;
  recipientProfile?: UserProfile;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  audioUrl?: string; // New: Voice Note URL
  timestamp: Timestamp;
  mediaUrl?: string;
}

export enum NotificationType {
    LIKE = 'like',
    COMMENT = 'comment',
    NEW_MESSAGE = 'new_message',
    CAMPAIGN_UPDATE = 'campaign_update',
    NEW_FOLLOWER = 'new_follower',
    SYSTEM_ALERT = 'system_alert' // New: System Announcements
}

export interface Notification {
    id: string;
    recipientId: string;
    senderId: string;
    senderProfile?: UserProfile;
    type: NotificationType;
    entityId: string; // e.g., postId, campaignId, conversationId
    message: string;
    read: boolean;
    createdAt: Timestamp;
}