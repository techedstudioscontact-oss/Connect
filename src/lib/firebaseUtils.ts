
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

/**
 * Fetches user profiles for a list of items (e.g., posts, notifications) in a single batch.
 * This avoids the N+1 query problem by collecting all unique user IDs and fetching them at once.
 */
export async function fetchUsersForItems<T extends { [key: string]: any }>(
  items: T[],
  idKey: keyof T,
  userKey: keyof T
): Promise<T[]> {
  const userIds = [...new Set(items.map(item => item[idKey]).filter(Boolean))];

  if (userIds.length === 0) {
    return items;
  }

  const usersMap = new Map<string, UserProfile>();
  
  const chunkSize = 30;
  for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      if (chunk.length > 0) {
        const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
        });
      }
  }

  return items.map(item => {
    const userProfile = usersMap.get(item[idKey]);
    return userProfile ? { ...item, [userKey]: userProfile } : item;
  });
}

// --- Cloudinary Upload Utility ---
const CLOUD_NAME = "dmtzn8zyz";
const UPLOAD_PRESET = "Collabsea";

interface CloudinaryResponse {
  secure_url: string;
  resource_type: 'image' | 'video' | 'raw';
  public_id: string;
}

export const uploadMedia = async (
    file: File | Blob, 
    userId: string, 
    purpose: 'profile' | 'post' | 'story' | 'audio'
): Promise<{ url: string; resource_type: 'image' | 'video' | 'raw'; public_id: string }> => {
    let resourceType = 'image';
    if (purpose === 'audio') {
        resourceType = 'video';
    } else if (file.type.startsWith('video/')) {
        resourceType = 'video';
    }
    
    if (file.type.includes('mp4') || file.type.includes('webm')) {
        resourceType = 'video';
    }
    
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    
    let folder;
    switch (purpose) {
        case 'profile':
            folder = 'profile_pics';
            break;
        case 'post':
            folder = resourceType === 'video' ? 'reels' : 'posts';
            break;
        case 'story':
            folder = 'stories';
            break;
        case 'audio':
            folder = file.type.includes('mp4') ? 'generated_videos' : 'voice_notes';
            break;
        default:
            folder = 'general';
    }
    formData.append("folder", folder);
    formData.append("public_id", `${userId}_${Date.now()}`);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Cloudinary upload error:", errorData);
      throw new Error(`Cloudinary upload failed: ${errorData.error.message}`);
    }
  
    const data: CloudinaryResponse = await response.json();
    return { url: data.secure_url, resource_type: data.resource_type, public_id: data.public_id };
};
