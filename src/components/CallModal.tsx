import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { X, Shield } from 'lucide-react';
import { auth } from '../lib/firebase';

interface CallModalProps {
  otherUser: {
    id: string;
    name: string;
    avatar: string;
  };
  isIncoming?: boolean;
  incomingCall?: any;
  peer?: any;
  onClose: () => void;
}

export function CallModal({ otherUser, isIncoming, onClose }: CallModalProps) {
  const [roomName, setRoomName] = useState<string>('');
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId || !otherUser.id) return;
    
    // Create a unique room name based on sorted IDs so both users join the same room
    const ids = [currentUserId, otherUser.id].sort();
    const generatedRoom = `Connact_Call_${ids[0]}_${ids[1]}`;
    setRoomName(generatedRoom);
  }, [currentUserId, otherUser.id]);

  if (!roomName) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col animate-fade-in">
      {/* Header Info */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-[1001] pointer-events-none">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <Shield className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-white tracking-tight">Secure Connact Call</span>
        </div>
        
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-rose-600 text-white shadow-lg pointer-events-auto active:scale-90 transition-transform"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 w-full h-full">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={roomName}
          configOverwrite={{
            startWithAudioMuted: false,
            disableModeratorIndicator: true,
            startScreenSharing: false,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            toolbarButtons: [
               'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
               'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
               'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
               'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
               'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
               'security'
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          }}
          userInfo={{
            displayName: auth.currentUser?.displayName || 'User',
            email: auth.currentUser?.email || ''
          }}
          onApiReady={(externalApi) => {
            // Handle hangup event from inside Jitsi
            externalApi.addEventListener('readyToClose', () => {
              onClose();
            });
          }}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
}
