
import React, { useState, useEffect, useRef } from 'react';
import { VideoConfig, AnimationStyle, AspectRatio, GenerationMode, AtmosphereType, LightingType } from '../nova/custom_video_model/types';
import { postCustomVideo } from '../nova/custom_video_model/api';
import { VideoRenderer } from '../nova/custom_video_model/VideoRenderer';
import { XCircleIcon, SparklesIcon, PlayIcon, VideoIcon, CodeBracketIcon, PhotoIcon, CheckBadgeIcon, ArrowUpTrayIcon, PaperClipIcon, VideoCameraIcon, TrashIcon, SpeakerWaveIcon } from './icons';
import { LoadingSpinner } from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
// No external GenAI import needed for UI logic now

interface CustomVideoModalProps {
    onClose: () => void;
    onSuccess: (videoUrl: string, text: string) => void;
}

const CustomVideoModal: React.FC<CustomVideoModalProps> = ({ onClose, onSuccess }) => {
    // --- Global State ---
    const [mode, setMode] = useState<GenerationMode>('procedural'); // 'procedural' or 'ai-generative'
    const [text, setText] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);

    // --- Procedural Mode State ---
    const [style, setStyle] = useState<AnimationStyle>('cosmic-drift');
    const [duration, setDuration] = useState(5);
    const [backgroundColor, setBackgroundColor] = useState('#0a0a0a');
    const [accentColor, setAccentColor] = useState('#6366f1');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);

    // --- AI Mode State ---
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [audioMood, setAudioMood] = useState('Epic Score');
    const [atmosphere, setAtmosphere] = useState<AtmosphereType>('sakura'); // Default to match user preference
    const [lighting, setLighting] = useState<LightingType>('golden-hour');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const audioMoods = ['Epic Score', 'Cinematic Ambience', 'Cyberpunk Synth', 'Nature Sounds', 'Silent'];
    const atmospheres: {id: AtmosphereType, label: string}[] = [
        {id: 'none', label: 'None'},
        {id: 'sakura', label: '🌸 Sakura'},
        {id: 'embers', label: '🔥 Embers'},
        {id: 'fireflies', label: '✨ Fireflies'},
        {id: 'rain', label: '🌧️ Rain'},
        {id: 'dust', label: '🌫️ Dust'}
    ];
    const lightings: {id: LightingType, label: string}[] = [
        {id: 'none', label: 'Normal'},
        {id: 'golden-hour', label: '☀️ Golden'},
        {id: 'midnight', label: '🌑 Midnight'},
        {id: 'cyber-punk', label: '👾 Cyber'},
        {id: 'dramatic', label: '🎭 Dramatic'}
    ];

    // --- Live Preview Loop ---
    useEffect(() => {
        // We now allow preview in AI mode too (basic image + effects if possible, but keep simple)
        // For accurate preview, we only run procedural. AI effects are render-time mostly.
        if (mode !== 'procedural') {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            return;
        }

        const animate = (time: number) => {
            if (startTimeRef.current === 0) startTimeRef.current = time;
            const elapsed = time - startTimeRef.current;
            const loopDuration = duration * 1000;
            const progress = (elapsed % loopDuration) / loopDuration;

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    const width = canvasRef.current.width;
                    const height = canvasRef.current.height;
                    const config: VideoConfig = {
                        text: text || "Nova AI",
                        style,
                        duration,
                        backgroundColor,
                        accentColor,
                        fps: 30,
                        aspectRatio,
                        mode: 'procedural'
                    };
                    VideoRenderer.drawFrame(ctx, config, progress, width, height);
                }
            }
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current!);
    }, [text, style, duration, backgroundColor, accentColor, aspectRatio, mode]);

    // --- Handlers ---

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setReferenceImage(ev.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!text && !referenceImage) return;
        setGenerationError(null);
        setGenerating(true);
        setResultVideoUrl(null);
        
        let progressVal = 0;
        // Faster progress since it's local
        const progressInterval = setInterval(() => {
            progressVal = Math.min(progressVal + 2, 95);
            setProgress(progressVal);
        }, 100);

        try {
            const config: VideoConfig = {
                mode,
                text,
                style,
                duration,
                backgroundColor,
                accentColor,
                fps: 30,
                aspectRatio,
                referenceImage: referenceImage || undefined,
                audioPrompt: mode === 'ai-generative' ? audioMood : undefined,
                atmosphere: mode === 'ai-generative' ? atmosphere : undefined,
                lighting: mode === 'ai-generative' ? lighting : undefined
            };

            const response = await postCustomVideo(config);
            
            clearInterval(progressInterval);
            setProgress(100);
            
            if (response.success && response.videoUrl) {
                setResultVideoUrl(response.videoUrl);
            } else {
                setGenerationError(response.error || "Generation failed.");
            }
        } catch (e: any) {
            clearInterval(progressInterval);
            setGenerationError(e.message || "An unexpected error occurred.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveAndClose = () => {
        if (resultVideoUrl) {
            onSuccess(resultVideoUrl, text);
            onClose();
        }
    };

    const applyPreset = (name: string) => {
        switch(name) {
            case 'Galactic': setStyle('cosmic-drift'); setBackgroundColor('#000000'); setAccentColor('#818cf8'); break;
            case 'Void': setStyle('geometric-void'); setBackgroundColor('#18181b'); setAccentColor('#2dd4bf'); break;
            case 'Cyberpunk': setStyle('cyber-grid'); setBackgroundColor('#0f0518'); setAccentColor('#d946ef'); break;
            case 'Matrix': setStyle('matrix-rain'); setBackgroundColor('#000000'); setAccentColor('#22c55e'); break;
            case 'Neon': setStyle('neon-pulse'); setBackgroundColor('#000000'); setAccentColor('#f43f5e'); break;
        }
    };

    // --- Components ---

    const ModeToggle = () => (
        <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/10">
            <button 
                onClick={() => setMode('procedural')} 
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'procedural' ? 'bg-white text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
                <SparklesIcon className="w-4 h-4" /> Motion Graphics
            </button>
            <button 
                onClick={() => setMode('ai-generative')} 
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${mode === 'ai-generative' ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
                <VideoCameraIcon className="w-4 h-4" /> Cinematic Engine
            </button>
        </div>
    );

    const AspectButton = ({ id, label }: { id: AspectRatio, label: string }) => (
        <button onClick={() => setAspectRatio(id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${aspectRatio === id ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}>{label}</button>
    );

    const getPreviewDimensions = () => {
        if (aspectRatio === '16:9') return 'aspect-video w-full';
        if (aspectRatio === '1:1') return 'aspect-square w-full max-w-[400px]';
        return 'aspect-[9/16] w-full max-w-[280px]';
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-0 sm:p-6 font-sans">
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-[#050505] w-full max-w-6xl h-full sm:h-[90vh] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col sm:flex-row border border-white/10"
            >
                {/* LEFT: PREVIEW AREA */}
                <div className="w-full sm:w-[60%] h-[40vh] sm:h-full relative flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-white/5 bg-[#020202]">
                    <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
                        <div className={`px-2 py-1 rounded-md text-[10px] font-mono border ${mode === 'ai-generative' ? 'border-purple-500/50 text-purple-400 bg-purple-500/10' : 'border-green-500/50 text-green-400 bg-green-500/10'}`}>
                            {mode === 'ai-generative' ? 'NATIVE CINEMATIC ENGINE' : 'CANVAS ENGINE'}
                        </div>
                        {generating && <span className="text-[10px] text-gray-500 animate-pulse">RENDERING...</span>}
                    </div>

                    <div className={`relative transition-all duration-500 ease-in-out ${getPreviewDimensions()} rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-[#0a0a0a]`}>
                        {resultVideoUrl ? (
                            <video src={resultVideoUrl} autoPlay loop controls className="w-full h-full object-cover" />
                        ) : mode === 'procedural' ? (
                            <canvas 
                                ref={canvasRef} 
                                width={aspectRatio === '16:9' ? 1920 : 1080} 
                                height={aspectRatio === '16:9' ? 1080 : (aspectRatio === '1:1' ? 1080 : 1920)} 
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-[#080808] relative overflow-hidden">
                                {referenceImage ? (
                                    <div className="absolute inset-0">
                                        <img src={referenceImage} alt="preview" className="w-full h-full object-cover opacity-50 blur-sm" />
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                                            {generating ? (
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                                    <p className="text-xs font-mono text-indigo-400 animate-pulse">APPLYING {atmosphere.toUpperCase()} PHYSICS...</p>
                                                </div>
                                            ) : (
                                                <p className="text-white text-sm font-semibold">Ready to Animate</p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    generating ? (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                            <p className="text-xs font-mono text-indigo-400 animate-pulse">SYNTHESIZING...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <VideoCameraIcon className="w-16 h-16 opacity-20 mb-4" />
                                            <p className="text-xs font-mono opacity-50">NATIVE PREVIEW</p>
                                            <p className="text-[10px] opacity-30 mt-1">Upload image to add Cinematic Effects</p>
                                        </>
                                    )
                                )}
                            </div>
                        )}
                        
                        {/* Error Overlay */}
                        {generationError && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6 text-center z-20">
                                <div>
                                    <XCircleIcon className="w-10 h-10 text-red-500 mx-auto mb-2" />
                                    <p className="text-sm text-red-200">{generationError}</p>
                                    <button onClick={() => setGenerationError(null)} className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs">Dismiss</button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-6 flex gap-2 bg-black/50 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                        <AspectButton id="16:9" label="16:9 Cinema" />
                        <AspectButton id="9:16" label="9:16 Social" />
                        <AspectButton id="1:1" label="1:1 Square" />
                    </div>
                </div>

                {/* RIGHT: CONTROLS */}
                <div className="w-full sm:w-[40%] h-[60vh] sm:h-full flex flex-col bg-[#050505]">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                            <span className="text-indigo-500"><SparklesIcon className="w-5 h-5"/></span>
                            Nova Studio
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        <ModeToggle />

                        {/* Common: Text Input */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Video Prompt / Overlay Text</label>
                            </div>
                            <textarea 
                                value={text} 
                                onChange={(e) => setText(e.target.value)} 
                                placeholder={mode === 'ai-generative' ? "Enter text to overlay on the cinematic video..." : "Enter text to animate..."}
                                rows={3}
                                className="w-full bg-[#0a0a0a] text-white p-4 rounded-xl border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-gray-700 text-sm resize-none"
                            />
                        </div>

                        {/* Mode Specific Controls */}
                        {mode === 'ai-generative' ? (
                            <div className="space-y-6 animate-fade-in-down">
                                {/* Visual Effects Controls */}
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <SparklesIcon className="w-3 h-3"/> Atmosphere
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {atmospheres.map(atm => (
                                                <button 
                                                    key={atm.id} 
                                                    onClick={() => setAtmosphere(atm.id)}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${atmosphere === atm.id ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                                                >
                                                    {atm.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                            <VideoIcon className="w-3 h-3"/> Lighting Filter
                                        </label>
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                            {lightings.map(l => (
                                                <button 
                                                    key={l.id} 
                                                    onClick={() => setLighting(l.id)}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${lighting === l.id ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                                                >
                                                    {l.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Audio Chips */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                        <SpeakerWaveIcon className="w-3 h-3"/> Soundtrack Generator
                                    </label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {audioMoods.map(m => (
                                            <button 
                                                key={m} 
                                                onClick={() => setAudioMood(m)}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all border ${audioMood === m ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Image Upload */}
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Source Image</label>
                                    {referenceImage ? (
                                        <div className="relative w-full h-32 rounded-xl overflow-hidden group border border-white/10">
                                            <img src={referenceImage} alt="ref" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                                            <button onClick={() => setReferenceImage(null)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-500/80 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    ) : (
                                        <div onClick={() => fileInputRef.current?.click()} className="w-full h-24 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors group">
                                            <PhotoIcon className="w-6 h-6 text-gray-600 group-hover:text-indigo-400 mb-2 transition-colors" />
                                            <span className="text-xs text-gray-500">Upload image to animate (Ken Burns Effect)</span>
                                            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl space-y-4 border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-gray-400">Duration</label>
                                        <span className="text-xs font-mono text-indigo-400">{duration}s</span>
                                    </div>
                                    <input type="range" min="3" max="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                </div>
                            </div>
                        ) : (
                            // Procedural Controls
                            <div className="space-y-6 animate-fade-in-down">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Quick Presets</label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {['Galactic', 'Void', 'Cyberpunk', 'Matrix', 'Neon'].map(p => (
                                            <button key={p} onClick={() => applyPreset(p)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-full text-xs font-medium text-gray-300 whitespace-nowrap transition-all">{p}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-white/5 rounded-xl space-y-4 border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-gray-400">Duration</label>
                                        <span className="text-xs font-mono text-indigo-400">{duration}s</span>
                                    </div>
                                    <input type="range" min="3" max="15" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                                    <div className="flex justify-between items-center pt-2">
                                        <label className="text-xs text-gray-400">Accent Color</label>
                                        <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-6 h-6 rounded-full cursor-pointer bg-transparent border-0 p-0" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 bg-[#080808]">
                        {resultVideoUrl ? (
                            <button onClick={handleSaveAndClose} className="w-full py-4 px-6 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                                <CheckBadgeIcon className="w-5 h-5" /> Use This Video
                            </button>
                        ) : (
                            <button onClick={handleGenerate} disabled={!text && !referenceImage || generating} className={`group w-full py-4 px-6 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${mode === 'ai-generative' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/30' : 'bg-white text-black hover:bg-gray-200'}`}>
                                {generating ? (
                                    <>
                                        <LoadingSpinner size="sm" />
                                        <span className="text-sm">Processing... {progress}%</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm tracking-wide">GENERATE {mode === 'ai-generative' ? 'VIDEO' : 'GRAPHICS'}</span>
                                        <PlayIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        )}
                        <p className="text-center text-[10px] text-gray-600 mt-3 font-mono">
                            {mode === 'ai-generative' ? 'NOVA NATIVE ENGINE • ZERO API COST' : 'NOVA CANVAS RENDERER V2.1'}
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default CustomVideoModal;
