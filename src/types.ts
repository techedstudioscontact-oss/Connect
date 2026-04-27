export type TabType = 'home' | 'chat' | 'games' | 'search' | 'profile' | 'video';
export type ChatModeType = 'global' | 'dm';

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  avatar?: string;
  bio?: string;
  isVerified?: boolean;
}
