import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, X } from 'lucide-react';
import Peer from 'peerjs';
import { auth } from '../lib/firebase';

interface CallModalProps {
  otherUser: {
    id: string;
    name: string;
    avatar: string;
  };
  isIncoming?: boolean;
  incomingCall?: any;
  peer: any;
  onClose: () => void;
}

export function CallModal({ otherUser, isIncoming, incomingCall, peer, onClose }: CallModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [callStatus, setCallStatus] = useState<string>(isIncoming ? 'Incoming Call...' : 'Calling...');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeCall, setActiveCall] = useState<any>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!peer) return;

    const startOrAnswer = async () => {
      try {
        const myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(myStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
        }

        if (isIncoming && incomingCall) {
          // If we are answering, we wait for the user to click Answer
          setActiveCall(incomingCall);
        } else if (!isIncoming) {
          // Start the outgoing call
          const call = peer.call(otherUser.id, myStream);
          setActiveCall(call);
          call.on('stream', (remoteMediaStream: MediaStream) => {
            setCallStatus('Connected');
            setRemoteStream(remoteMediaStream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteMediaStream;
            }
          });
        }
      } catch (err) {
        console.error("Failed to get local stream", err);
        setCallStatus('Camera/Mic Access Denied');
      }
    };

    startOrAnswer();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [otherUser.id, isIncoming, peer, incomingCall]);

  const handleAnswer = () => {
    if (activeCall && stream) {
      activeCall.answer(stream);
      setIsAnswered(true);
      setCallStatus('Connected');
      activeCall.on('stream', (remoteMediaStream: MediaStream) => {
        setRemoteStream(remoteMediaStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteMediaStream;
        }
      });
    }
  };

  const endCall = () => {
    activeCall?.close();
    stream?.getTracks().forEach(track => track.stop());
    onClose();
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !isVideoOff;
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col items-center justify-center animate-fade-in text-white">
      {/* Background Remote Video */}
      {remoteStream ? (
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-emerald-400 to-indigo-500 animate-pulse">
            <img src={otherUser.avatar} className="w-full h-full rounded-full object-cover" alt="" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight">{otherUser.name}</h2>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-[10px] mt-2">{callStatus}</p>
          </div>
        </div>
      )}

      {/* Local Video Preview (Miniature) */}
      <div className="absolute top-10 right-5 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800">
        <video 
          ref={localVideoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-full h-full object-cover"
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            <VideoOff className="w-6 h-6 text-slate-500" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 flex items-center gap-6 px-8 py-5 bg-black/30 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-2xl">
        {isIncoming && !isAnswered ? (
          <>
            <button 
              onClick={handleAnswer}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 transition-all active:scale-90 animate-bounce"
            >
              <Phone className="w-8 h-8" />
            </button>
            <button 
              onClick={endCall}
              className="w-16 h-16 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/30 transition-all active:scale-90"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={toggleMic}
              className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button 
              onClick={endCall}
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
          </>
        )}
      </div>

      {/* Header Info */}
      <div className="absolute top-10 left-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div className="text-sm font-bold opacity-60 tracking-tight">End-to-End Encrypted</div>
      </div>
    </div>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}
