import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Shield } from 'lucide-react';
import { auth } from '../lib/firebase';

const AGORA_APP_ID = "3ab2399d5baa4fb09f27cc74cc1bab76";

interface CallModalProps {
  otherUser: {
    id: string;
    name: string;
    avatar: string;
  };
  isIncoming?: boolean;
  onClose: () => void;
}

export function CallModal({ otherUser, isIncoming, onClose }: CallModalProps) {
  const [callStatus, setCallStatus] = useState<string>(isIncoming ? 'Incoming Call...' : 'Connecting...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        
        client.current.on("user-published", async (user, mediaType) => {
          await client.current?.subscribe(user, mediaType);
          if (!isMounted) return;

          if (mediaType === "video") {
            setRemoteUser(user);
            setCallStatus('Connected');
            setTimeout(() => {
              if (remoteVideoRef.current) user.videoTrack?.play(remoteVideoRef.current);
            }, 100);
          }
          if (mediaType === "audio") {
            user.audioTrack?.play();
          }
        });

        client.current.on("user-unpublished", (user) => {
          if (user.uid === remoteUser?.uid) {
            setRemoteUser(null);
            setCallStatus('User disconnected');
            onClose();
          }
        });

        const currentUserId = auth.currentUser?.uid;
        if (!currentUserId || !otherUser.id) return;
        
        // Generate Channel Name
        const ids = [currentUserId, (otherUser as any).userId || otherUser.id].sort();
        const channelName = `connact_v_${ids[0]}_${ids[1]}`;

        // Join with null token (Requires "App Certificate" to be DISABLED in Agora Console)
        await client.current.join(AGORA_APP_ID, channelName, null, currentUserId);
        
        localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
        localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();
        
        if (isMounted && localVideoRef.current) {
          localVideoTrack.current.play(localVideoRef.current);
        }

        await client.current.publish([localAudioTrack.current, localVideoTrack.current]);
        if (isMounted) setCallStatus(isIncoming ? 'Joined Call' : 'Ringing...');
      } catch (e: any) {
        console.error("Agora Error:", e);
        if (isMounted) {
          if (e.message?.includes("token")) {
            setCallStatus('Security Error: Token Required');
          } else {
            setCallStatus('Connection Error');
          }
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      localAudioTrack.current?.close();
      localVideoTrack.current?.close();
      client.current?.leave();
    };
  }, [otherUser.id]);

  const toggleMic = async () => {
    if (localAudioTrack.current) {
      const newState = !isMuted;
      await localAudioTrack.current.setEnabled(!newState);
      setIsMuted(newState);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack.current) {
      const newState = !isVideoOff;
      await localVideoTrack.current.setEnabled(!newState);
      setIsVideoOff(newState);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0c1222] flex flex-col items-center justify-center animate-fade-in text-white overflow-hidden">
      {/* Remote Video Container */}
      <div ref={remoteVideoRef} className="absolute inset-0 w-full h-full bg-slate-900 object-cover">
         {!remoteUser && (
           <div className="flex flex-col items-center gap-6 mt-[-100px] animate-pulse">
             <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-indigo-500">
               <img src={otherUser.avatar} className="w-full h-full rounded-full object-cover shadow-2xl" alt="" />
             </div>
             <div className="text-center">
               <h2 className="text-2xl font-black tracking-tight">{otherUser.name}</h2>
               <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-2">{callStatus}</p>
             </div>
           </div>
         )}
      </div>

      {/* Local Preview */}
      <div 
        ref={localVideoRef} 
        className="absolute top-10 right-5 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800 z-50 transition-all active:scale-95"
      >
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
            <VideoOff className="w-6 h-6 text-slate-500" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 flex items-center gap-6 px-8 py-5 bg-black/40 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl z-50">
        <button 
          onClick={toggleMic}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-90 ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button 
          onClick={onClose}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/30 transition-all active:scale-75"
        >
          <PhoneOff className="w-8 h-8" />
        </button>

        <button 
          onClick={toggleVideo}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-all active:scale-90 ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
      </div>

      <div className="absolute top-10 left-5 flex items-center gap-3 z-50 opacity-60">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest">Connact Secure Call</div>
      </div>
    </div>
  );
}
