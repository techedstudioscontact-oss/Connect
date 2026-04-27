
import { VideoConfig, AnimationStyle, AtmosphereType, LightingType } from './types';

class AudioGenerator {
    private ctx: AudioContext;
    private dest: MediaStreamAudioDestinationNode;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.dest = this.ctx.createMediaStreamDestination();
    }

    public getStream(): MediaStream {
        return this.dest.stream;
    }

    public async generateSoundtrack(mood: string, duration: number) {
        const ctx = this.ctx;
        const dest = this.dest;
        const now = ctx.currentTime;
        const end = now + duration;

        // Master Gain for fade in/out
        const masterGain = ctx.createGain();
        masterGain.connect(dest);
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(0.5, now + 1); // Fade in
        masterGain.gain.linearRampToValueAtTime(0, end); // Fade out

        if (mood === 'Cyberpunk Synth') {
            // Arpeggiated Bass
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(55, now); // A1
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400, now);
            filter.frequency.linearRampToValueAtTime(2000, end);
            osc.connect(filter);
            filter.connect(masterGain);
            osc.start(now);
            osc.stop(end);
        } else if (mood === 'Epic Score') {
            // Orchestral Drone (Low strings emulation)
            [110, 164.8, 220].forEach(freq => { // A Major chord spread
                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                const gain = ctx.createGain();
                gain.gain.value = 0.2;
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now);
                osc.stop(end);
            });
        } else if (mood === 'Nature Sounds') {
            // Pink Noise for wind/rain
            const bufferSize = 2 * ctx.sampleRate;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5; 
            }
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;
            noise.connect(filter);
            filter.connect(masterGain);
            noise.start(now);
            noise.stop(end);
        } else if (mood === 'Cinematic Ambience') {
             // Deep Space Drone
             const osc1 = ctx.createOscillator();
             osc1.frequency.value = 60;
             const osc2 = ctx.createOscillator();
             osc2.frequency.value = 62; // Detuned
             const gain = ctx.createGain();
             gain.gain.value = 0.3;
             osc1.connect(gain);
             osc2.connect(gain);
             gain.connect(masterGain);
             osc1.start(now);
             osc2.start(now);
             osc1.stop(end);
             osc2.stop(end);
        }
    }
    
    public close() {
        this.ctx.close();
    }
}

// Global helper for noise generation
let lastOut = 0;

// --- Particle System ---
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    alpha: number;
    rotation: number;
    rotationSpeed: number;
    life: number;
}

class ParticleEngine {
    private particles: Particle[] = [];
    private width: number;
    private height: number;
    private type: AtmosphereType;

    constructor(width: number, height: number, type: AtmosphereType) {
        this.width = width;
        this.height = height;
        this.type = type;
        this.initParticles();
    }

    private initParticles() {
        const count = this.type === 'rain' ? 300 : this.type === 'none' ? 0 : 80;
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle(true));
        }
    }

    private createParticle(randomY: boolean = false): Particle {
        const x = Math.random() * this.width;
        const y = randomY ? Math.random() * this.height : -20;
        let vx = 0, vy = 0, size = 0, color = '', rotation = 0, rotationSpeed = 0;

        switch (this.type) {
            case 'sakura':
                vx = Math.random() * 2 - 1; // Sway
                vy = Math.random() * 2 + 1; // Fall
                size = Math.random() * 8 + 4;
                color = Math.random() > 0.5 ? '#ffb7b2' : '#ffdac1'; // Pink/Peach
                rotation = Math.random() * 360;
                rotationSpeed = Math.random() * 2 - 1;
                break;
            case 'embers':
                vx = Math.random() * 1 - 0.5;
                vy = -(Math.random() * 2 + 1); // Rise
                size = Math.random() * 4 + 1;
                color = Math.random() > 0.5 ? '#ff4500' : '#ffa500';
                break;
            case 'fireflies':
                vx = Math.random() * 2 - 1;
                vy = Math.random() * 2 - 1;
                size = Math.random() * 3 + 1;
                color = '#ccff00';
                break;
            case 'rain':
                vx = -1; // Slight wind
                vy = Math.random() * 15 + 10; // Fast
                size = Math.random() * 2 + 20; // Length
                color = '#a0a0a0';
                break;
            case 'dust':
                vx = Math.random() * 0.5 - 0.25;
                vy = Math.random() * 0.5 - 0.25;
                size = Math.random() * 2 + 0.5;
                color = '#ffffff';
                break;
            case 'snow':
                vx = Math.random() * 1 - 0.5;
                vy = Math.random() * 2 + 1;
                size = Math.random() * 3 + 2;
                color = '#ffffff';
                break;
        }

        return { x, y: randomY ? y : (this.type === 'embers' ? this.height + 20 : -20), vx, vy, size, color, alpha: Math.random(), rotation, rotationSpeed, life: 1 };
    }

    public update() {
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            if (this.type === 'sakura') {
                p.x += Math.sin(p.y * 0.01) * 0.5; // Swaying motion
            }

            // Reset if out of bounds
            if (p.y > this.height + 20 || p.y < -30 || p.x > this.width + 20 || p.x < -20) {
                Object.assign(p, this.createParticle(false));
            }
        });
    }

    public draw(ctx: CanvasRenderingContext2D) {
        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;

            if (this.type === 'sakura') {
                // Draw petal shape
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.type === 'rain') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-2, p.size); // Slanted rain
                ctx.stroke();
            } else {
                // Circle for others
                ctx.beginPath();
                ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        });
    }
}

export class VideoRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number = 1080;
    private height: number = 1920; 
    private particleEngine?: ParticleEngine;
    
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error("Could not get 2D context");
        this.ctx = context;
    }

    public static drawFrame(
        ctx: CanvasRenderingContext2D, 
        config: VideoConfig, 
        progress: number, 
        width: number, 
        height: number,
        imageElement?: HTMLImageElement,
        particleEngine?: ParticleEngine
    ) {
        // Clear background
        ctx.fillStyle = config.backgroundColor || '#000000';
        ctx.fillRect(0, 0, width, height);

        if (config.mode === 'ai-generative' && imageElement) {
            this.drawCinematicImage(ctx, imageElement, progress, width, height, config, particleEngine);
            return;
        }

        switch (config.style) {
            case 'neon-pulse': this.drawNeonPulse(ctx, config, progress, width, height); break;
            case 'kinetic-slide': this.drawKineticSlide(ctx, config, progress, width, height); break;
            case 'matrix-rain': this.drawMatrixRain(ctx, config, progress, width, height); break;
            case 'cyber-grid': this.drawCyberGrid(ctx, config, progress, width, height); break;
            case 'neural-net': this.drawNeuralNet(ctx, config, progress, width, height); break;
            case 'cosmic-drift': this.drawCosmicDrift(ctx, config, progress, width, height); break;
            case 'geometric-void': this.drawGeometricVoid(ctx, config, progress, width, height); break;
            default: this.drawNeonPulse(ctx, config, progress, width, height);
        }
    }

    private static drawCinematicImage(
        ctx: CanvasRenderingContext2D, 
        img: HTMLImageElement, 
        progress: number, 
        width: number, 
        height: number,
        config: VideoConfig,
        particleEngine?: ParticleEngine
    ) {
        // 1. Ken Burns Effect (Zoom In & Pan)
        const scale = 1 + (progress * 0.10); // Subtle 10% zoom
        const xOffset = (width * 0.02) * Math.sin(progress * Math.PI / 2); // Slight pan
        
        ctx.save();
        ctx.translate(width/2, height/2);
        ctx.scale(scale, scale);
        ctx.translate(-width/2 - xOffset, -height/2);
        
        // Draw Image Covering Canvas
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let renderW, renderH, renderX, renderY;

        if (imgRatio > canvasRatio) {
            renderH = height;
            renderW = height * imgRatio;
            renderX = (width - renderW) / 2;
            renderY = 0;
        } else {
            renderW = width;
            renderH = width / imgRatio;
            renderX = 0;
            renderY = (height - renderH) / 2;
        }
        
        ctx.drawImage(img, renderX, renderY, renderW, renderH);
        ctx.restore();

        // 2. Particle System Overlay
        if (particleEngine) {
            particleEngine.update();
            particleEngine.draw(ctx);
        }

        // 3. Lighting & Grading Effects
        if (config.lighting && config.lighting !== 'none') {
            ctx.save();
            ctx.globalCompositeOperation = 'overlay'; // Blend mode for cinematic look
            const grad = ctx.createRadialGradient(width/2, 0, 0, width/2, height/2, height);
            
            if (config.lighting === 'golden-hour') {
                grad.addColorStop(0, 'rgba(255, 160, 0, 0.4)'); // Orange sun
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
            } else if (config.lighting === 'midnight') {
                grad.addColorStop(0, 'rgba(0, 20, 60, 0.5)'); // Deep blue
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
            } else if (config.lighting === 'cyber-punk') {
                grad.addColorStop(0, 'rgba(0, 255, 255, 0.3)'); // Cyan
                grad.addColorStop(1, 'rgba(255, 0, 255, 0.3)'); // Magenta
            } else if (config.lighting === 'dramatic') {
                ctx.globalCompositeOperation = 'soft-light';
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
            }
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }

        // 4. Vignette (Standard Cinematic)
        const vignette = ctx.createRadialGradient(width/2, height/2, width*0.4, width/2, height/2, width*0.9);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, width, height);

        // 5. Letterbox (Cinematic Bars)
        const barHeight = height * 0.08;
        ctx.fillStyle = "black";
        // Animate bars slightly opening
        const currentBarHeight = barHeight * (1 - Math.min(1, progress * 3)); 
        // Or keep static if preferred, but let's make them static for "Cinematic" feel or just animate opacity
        // Let's keep them static for now, looks more pro.
        ctx.fillRect(0, 0, width, barHeight);
        ctx.fillRect(0, height - barHeight, width, barHeight);

        // 6. Text Overlay
        if (config.text) {
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 15;
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.font = `300 ${width * 0.05}px 'Poppins', sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.globalAlpha = Math.min(1, progress * 3); // Quick fade in
            
            // Draw text near bottom but above bars
            const textY = height - (barHeight * 1.5);
            ctx.fillText(config.text, width/2, textY);
            ctx.restore();
        }
    }

    // ... (Procedural methods: drawNeonPulse, etc. remain unchanged)
    private static drawNeonPulse(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { text, accentColor } = config;
        const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.05;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(scale, scale);
        ctx.shadowBlur = 40 + Math.sin(progress * Math.PI * 4) * 20;
        ctx.shadowColor = accentColor;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${width * 0.08}px Inter, sans-serif`; 
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = text.split(' ');
        if (text.length > 20) {
             const mid = Math.floor(words.length / 2);
             const line1 = words.slice(0, mid).join(' ');
             const line2 = words.slice(mid).join(' ');
             ctx.fillText(line1, 0, -width * 0.05);
             ctx.fillText(line2, 0, width * 0.05);
        } else {
             ctx.fillText(text, 0, 0);
        }
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = width * 0.01;
        ctx.beginPath();
        ctx.arc(0, 0, (width * 0.4) + Math.sin(progress * Math.PI * 2) * 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    private static drawKineticSlide(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { text, accentColor } = config;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 6); 
        ctx.fillStyle = accentColor;
        ctx.font = `bold ${width * 0.15}px Inter, sans-serif`;
        ctx.textAlign = "center";
        const slideSpeed = 1000;
        for(let i = -6; i <= 6; i++) {
            const dir = i % 2 === 0 ? 1 : -1;
            const xPos = (dir * (progress * slideSpeed) + (i * 50)) % (width + 1000) - (width/2 + 500);
            ctx.globalAlpha = 1 - (Math.abs(i) * 0.12);
            if(ctx.globalAlpha < 0) ctx.globalAlpha = 0;
            ctx.fillText(text.toUpperCase(), xPos, i * (width * 0.14));
        }
        ctx.restore();
    }

    private static drawMatrixRain(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        ctx.fillStyle = config.accentColor;
        ctx.font = `${width * 0.03}px monospace`;
        const columns = Math.floor(width / (width * 0.03));
        for (let i = 0; i < columns; i++) {
            const speed = (Math.sin(i * 99) + 2) * 2000; 
            const offset = Math.cos(i * 50) * height;
            const y = (offset + progress * speed) % height;
            for (let j = 0; j < 5; j++) {
                 const char = String.fromCharCode(0x30A0 + Math.abs(Math.floor(Math.sin(i * j + progress) * 96)));
                 ctx.globalAlpha = 1 - (j * 0.2);
                 ctx.fillText(char, i * (width * 0.03), y - j * (width * 0.03));
            }
        }
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${width * 0.08}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(config.text, width/2, height/2);
        ctx.restore();
    }

    private static drawCyberGrid(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { accentColor } = config;
        const horizon = height * 0.4;
        ctx.save();
        const sunY = horizon - (height * 0.1);
        const sunGradient = ctx.createLinearGradient(0, sunY - 100, 0, sunY + 100);
        sunGradient.addColorStop(0, "#F59E0B"); 
        sunGradient.addColorStop(1, "#EC4899"); 
        ctx.fillStyle = sunGradient;
        ctx.beginPath();
        ctx.arc(width/2, sunY, width * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(0, horizon, width, height - horizon);
        ctx.clip();
        const gridGrad = ctx.createLinearGradient(0, horizon, 0, height);
        gridGrad.addColorStop(0, "rgba(0,0,0,1)");
        gridGrad.addColorStop(1, config.accentColor);
        ctx.fillStyle = gridGrad;
        ctx.fillRect(0, horizon, width, height - horizon);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        const perspectiveCenter = width / 2;
        for(let i = -10; i <= 10; i++) {
            const x = perspectiveCenter + (i * width * 0.2) * (1 + Math.sin(progress * 0.1));
            ctx.beginPath();
            ctx.moveTo(perspectiveCenter, horizon);
            ctx.lineTo(x + (i * width * 1.5), height);
            ctx.stroke();
        }
        const speed = 2000;
        const loopPos = (progress * speed) % 200;
        for (let i = 0; i < 20; i++) {
            const y = horizon + Math.pow(i, 2.5) * 2 + loopPos; 
            if (y > height) continue;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#ffffff";
        ctx.font = `italic bold ${width * 0.1}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(config.text.toUpperCase(), width/2, height * 0.3);
    }

    private static drawNeuralNet(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { accentColor } = config;
        const particleCount = 40;
        const particles = [];
        for(let i=0; i<particleCount; i++) {
            const x = ((i * 137.5) % width);
            const y = ((i * 293.3 + progress * 500) % height);
            particles.push({x, y});
        }
        ctx.fillStyle = accentColor;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        for(let i=0; i<particleCount; i++) {
            const p1 = particles[i];
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
            ctx.fill();
            for(let j=i+1; j<particleCount; j++) {
                const p2 = particles[j];
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist < width * 0.15) {
                    ctx.globalAlpha = 1 - (dist / (width * 0.15));
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${width * 0.08}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(config.text, width/2, height/2);
    }

    private static drawCosmicDrift(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { accentColor } = config;
        
        const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
        grad.addColorStop(0, "#1e1b4b"); 
        grad.addColorStop(1, "#000000");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#ffffff";
        const starCount = 100;
        for (let i = 0; i < starCount; i++) {
            const r = (i * 123.45) % width;
            const angle = (i * 32.1 + progress * Math.PI) % (Math.PI * 2);
            const dist = (i * 10 + progress * 1000) % (Math.max(width, height) / 1.5);
            
            const x = width/2 + Math.cos(angle + i) * dist;
            const y = height/2 + Math.sin(angle + i) * dist;
            
            const size = (dist / width) * 4;
            ctx.globalAlpha = Math.min(1, dist / (width/4));
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = accentColor;
        const cloudX = width/2 + Math.sin(progress * Math.PI) * 200;
        const cloudY = height/2 + Math.cos(progress * Math.PI) * 200;
        ctx.filter = "blur(100px)"; 
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, width/3, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = "none";

        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(width/2, height/2);
        const textScale = 1 + Math.sin(progress * Math.PI * 2) * 0.1;
        ctx.scale(textScale, textScale);
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 50;
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${width * 0.1}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(config.text.toUpperCase(), 0, 0);
        ctx.restore();
    }

    private static drawGeometricVoid(ctx: CanvasRenderingContext2D, config: VideoConfig, progress: number, width: number, height: number) {
        const { accentColor, backgroundColor } = config;
        
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 3;
        const centerX = width / 2;
        const centerY = height / 2;
        const shapeCount = 10;
        const maxRadius = width * 0.8;

        for (let i = 0; i < shapeCount; i++) {
            const p = (progress + i/shapeCount) % 1;
            const size = p * maxRadius;
            const rotation = p * Math.PI * 2;
            const opacity = 1 - p;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(rotation);
            ctx.globalAlpha = opacity;
            
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const angle = (j * Math.PI * 2) / 6;
                const x = Math.cos(angle) * size;
                const y = Math.sin(angle) * size;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${width * 0.08}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 20;
        ctx.fillText(config.text, centerX, centerY);
    }

    public async generate(config: VideoConfig): Promise<Blob> {
        // Set dimensions based on aspect ratio
        if (config.aspectRatio === '16:9') {
            this.canvas.width = 1920;
            this.canvas.height = 1080;
        } else if (config.aspectRatio === '1:1') {
            this.canvas.width = 1080;
            this.canvas.height = 1080;
        } else {
            this.canvas.width = 1080;
            this.canvas.height = 1920;
        }
        
        this.ctx = this.canvas.getContext('2d')!;

        // Handle Image loading for AI mode
        let imageElement: HTMLImageElement | undefined;
        let particleEngine: ParticleEngine | undefined;

        if (config.mode === 'ai-generative' && config.referenceImage) {
            imageElement = new Image();
            imageElement.src = config.referenceImage;
            await new Promise((resolve) => { imageElement!.onload = resolve; });
            
            // Initialize Particle Engine
            if (config.atmosphere && config.atmosphere !== 'none') {
                particleEngine = new ParticleEngine(this.canvas.width, this.canvas.height, config.atmosphere);
            }
        }

        // Initialize Audio
        const audioGenerator = new AudioGenerator();
        audioGenerator.generateSoundtrack(config.audioPrompt || 'Epic Score', config.duration);
        const audioStream = audioGenerator.getStream();

        // Canvas Stream
        const canvasStream = this.canvas.captureStream(config.fps);
        
        // Combine streams
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...audioStream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        return new Promise((resolve, reject) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                audioGenerator.close();
                resolve(blob);
            };
            
            recorder.onerror = (e) => reject(e);

            recorder.start();

            let currentFrame = 0;
            const totalFrames = config.duration * (config.fps || 30);

            const renderLoop = () => {
                if (currentFrame >= totalFrames) {
                    recorder.stop();
                    return;
                }

                const progress = currentFrame / totalFrames;

                VideoRenderer.drawFrame(
                    this.ctx, 
                    config, 
                    progress, 
                    this.canvas.width, 
                    this.canvas.height, 
                    imageElement,
                    particleEngine
                );

                currentFrame++;
                setTimeout(renderLoop, 1000 / (config.fps || 30)); 
            };

            renderLoop();
        });
    }
}
