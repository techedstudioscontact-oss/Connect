
export type AnimationStyle = 'neon-pulse' | 'kinetic-slide' | 'matrix-rain' | 'cyber-grid' | 'neural-net' | 'cosmic-drift' | 'geometric-void';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type GenerationMode = 'procedural' | 'ai-generative';

export type AtmosphereType = 'none' | 'sakura' | 'embers' | 'fireflies' | 'rain' | 'snow' | 'dust';
export type LightingType = 'none' | 'golden-hour' | 'midnight' | 'cyber-punk' | 'noir' | 'dramatic';

export interface VideoConfig {
    // Shared
    mode?: GenerationMode;
    text: string; // Used as prompt for AI or overlay text
    duration: number; // in seconds
    aspectRatio?: AspectRatio;
    
    // Procedural specific
    style?: AnimationStyle;
    backgroundColor?: string; // hex
    accentColor?: string; // hex
    secondaryText?: string;
    fps?: number;

    // AI/Cinematic specific
    referenceImage?: string; // base64
    enhancePrompt?: boolean;
    visualStyle?: string; // Kept for backward compatibility or future AI use
    audioPrompt?: string; // e.g. "Epic Orchestral", "Cyberpunk Synth"
    
    // Native Engine Visual Effects
    atmosphere?: AtmosphereType;
    lighting?: LightingType;
}

export interface VideoGenerationResponse {
    success: boolean;
    videoUrl?: string;
    error?: string;
    metadata?: {
        duration: number;
        size: number;
        format: string;
        engine: string;
    };
}
