

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

/**
 * Fetches user profiles for a list of items (e.g., posts, notifications) in a single batch.
 * This avoids the N+1 query problem by collecting all unique user IDs and fetching them at once.
 * 
 * @param items - An array of items that have a userId or similar property.
 * @param idKey - The key on the item object that holds the user ID (e.g., 'userId', 'senderId').
 * @param userKey - The key on the item object where the fetched user profile should be attached (e.g., 'user', 'senderProfile').
 * @returns A new array of items with the user profiles attached.
 */
export async function fetchUsersForItems<T extends { [key: string]: any }>(
  items: T[],
  idKey: keyof T,
  userKey: keyof T
): Promise<T[]> {
  // Get unique user IDs, filtering out any falsy values
  const userIds = [...new Set(items.map(item => item[idKey]).filter(Boolean))];

  if (userIds.length === 0) {
    return items;
  }

  const usersMap = new Map<string, UserProfile>();
  
  // Firestore 'in' query supports up to 30 elements per query.
  // We need to chunk the userIds array to handle more than 30.
  const chunkSize = 30;
  for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      // NOTE: Firestore's `in` query requires a non-empty array.
      if (chunk.length > 0) {
        const usersQuery = query(collection(db, 'users'), where('__name__', 'in', chunk));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => {
            usersMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile);
        });
      }
  }

  // Attach user profiles to the original items
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
  resource_type: 'image' | 'video' | 'raw'; // Cloudinary treats audio as video or raw often
  public_id: string;
}

/**
 * Uploads a file to Cloudinary and returns the secure URL.
 * @param file - The file or blob to upload.
 * @param userId - The UID of the user uploading the file.
 * @param purpose - The purpose of the upload to determine the folder in Cloudinary.
 * @returns An object containing the secure URL and the resource type.
 */
export const uploadMedia = async (
    file: File | Blob, 
    userId: string, 
    purpose: 'profile' | 'post' | 'story' | 'audio'
): Promise<{ url: string; resource_type: 'image' | 'video' | 'raw'; public_id: string }> => {
    let resourceType = 'image';
    if (purpose === 'audio') {
        resourceType = 'video'; // Cloudinary handles audio/video uploads under 'video' resource type
    } else if (file.type.startsWith('video/')) {
        resourceType = 'video';
    }
    
    // Override if we detect it's likely a video blob but purpose wasn't specific (fallback safety)
    if (file.type.includes('mp4') || file.type.includes('webm')) {
        resourceType = 'video';
    }
    
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    
    // Set folder and public_id for better organization in Cloudinary
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
            // If it's a generated video, store separately, otherwise voice notes
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