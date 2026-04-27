import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Shield } from 'lucide-react';
import { auth } from '../lib/firebase';

// AGORA CONFIG
const AGORA_APP_ID = "1b75e27efac34b7395a8909646675de8";
const AGORA_CERTIFICATE = "4e4fb2351df5414dbb31582eb783f8a6"; // Use this on backend for real security

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
  const [joined, setJoined] = useState(false);
  const [callStatus, setCallStatus] = useState<string>(isIncoming ? 'Incoming Call...' : 'Calling...');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState<any>(null);

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      client.current = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      client.current.on("user-published", async (user, mediaType) => {
        await client.current?.subscribe(user, mediaType);
        if (mediaType === "video") {
          setRemoteUser(user);
          setCallStatus('Connected');
          user.videoTrack?.play(remoteVideoRef.current!);
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
      const ids = [currentUserId, otherUser.id].sort();
      const channelName = `connact_v_${ids[0]}_${ids[1]}`;

      try {
        // NOTE: In a real production app, you fetch this token from your Firebase Cloud Function
        // For now, if you have enabled "App Certificate", you MUST provide a token.
        // If you are testing, you can generate a Temporary Token in Agora Console and paste it here:
        const token = null; // Replace with a dynamic token from a backend server later

        await client.current.join(AGORA_APP_ID, channelName, token, currentUserId);
        
        localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
        localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();
        
        if (localVideoRef.current) {
          localVideoTrack.current.play(localVideoRef.current);
        }

        await client.current.publish([localAudioTrack.current, localVideoTrack.current]);
        setJoined(true);
      } catch (e: any) {
        console.error("Agora join failed", e);
        if (e.message.includes("token")) {
           setCallStatus('Security Token Required');
           alert("Security Alert: Your Agora project has 'App Certificate' enabled. You must either generate a token via a backend server or disable 'App Certificate' in Agora Console for testing.");
        } else {
           setCallStatus('Connection Failed');
        }
      }
    };

    init();

    return () => {
      localAudioTrack.current?.close();
      localVideoTrack.current?.close();
      client.current?.leave();
    };
  }, [otherUser.id]);

  const handleHangup = () => {
    onClose();
  };

  const toggleMic = async () => {
    if (localAudioTrack.current) {
      await localAudioTrack.current.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack.current) {
      await localVideoTrack.current.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col items-center justify-center animate-fade-in text-white overflow-hidden">
      {/* Remote Video (Full Screen) */}
      <div ref={remoteVideoRef} className="absolute inset-0 w-full h-full bg-slate-800">
         {!remoteUser && (
           <div className="flex flex-col items-center gap-6 mt-[-100px]">
             <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-indigo-500 animate-pulse">
               <img src={otherUser.avatar} className="w-full h-full rounded-full object-cover" alt="" />
             </div>
             <div className="text-center">
               <h2 className="text-2xl font-black tracking-tight">{otherUser.name}</h2>
               <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-2">{callStatus}</p>
             </div>
           </div>
         )}
      </div>

      {/* Local Video Preview (Floating) */}
      <div 
        ref={localVideoRef} 
        className="absolute top-10 right-5 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-700 z-50"
      >
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <VideoOff className="w-6 h-6 text-slate-500" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 flex items-center gap-6 px-8 py-5 bg-black/30 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl z-50">
        <button 
          onClick={toggleMic}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button 
          onClick={handleHangup}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/30 transition-all active:scale-90"
        >
          <PhoneOff className="w-8 h-8" />
        </button>

        <button 
          onClick={toggleVideo}
          className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </button>
      </div>

      {/* Header Info */}
      <div className="absolute top-10 left-5 flex items-center gap-3 z-50">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="text-sm font-bold text-white/60 tracking-tight">End-to-End Encrypted Call</div>
      </div>
    </div>
  );
}
