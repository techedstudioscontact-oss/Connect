
import { VideoConfig, VideoGenerationResponse } from './types';
import { VideoRenderer } from './VideoRenderer';

/**
 * Routes the generation request. Both modes now run LOCALLY via the Canvas Renderer.
 */
export async function postCustomVideo(config: VideoConfig): Promise<VideoGenerationResponse> {
    // Both modes use the same local renderer now, just different draw logic internally.
    return generateLocalVideo(config);
}

async function generateLocalVideo(config: VideoConfig): Promise<VideoGenerationResponse> {
    try {
        const renderer = new VideoRenderer();
        const videoBlob = await renderer.generate({
            ...config,
            style: config.style || 'neon-pulse',
            backgroundColor: config.backgroundColor || '#000000',
            accentColor: config.accentColor || '#00E5FF',
            fps: config.fps || 30
        });
        const videoUrl = URL.createObjectURL(videoBlob);
        
        const engineName = config.mode === 'ai-generative' 
            ? 'Nova Cinematic Engine (Native)' 
            : 'Nova Canvas Engine v2.1';

        return {
            success: true,
            videoUrl: videoUrl,
            metadata: {
                duration: config.duration,
                size: videoBlob.size,
                format: 'video/webm',
                engine: engineName
            }
        };
    } catch (error: any) {
        console.error("Video Gen Error:", error);
        return {
            success: false,
            error: error.message || "Unknown error during video generation"
        };
    }
}
