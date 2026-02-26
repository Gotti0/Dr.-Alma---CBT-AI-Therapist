import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Pause, Play, Loader2 } from 'lucide-react';
import { generateTtsAudio } from '../services/gemini';
import { pcmBase64ToWavUrl } from '../utils/audioUtils';

// 메시지 ID → 오디오 URL 캐시
const audioCache = new Map<string, string>();

type PlayerState = 'idle' | 'loading' | 'playing' | 'paused';

interface AudioPlayerProps {
    messageId: string;
    text: string;
    voiceName?: string;
}

export default function AudioPlayer({ messageId, text, voiceName = 'Kore' }: AudioPlayerProps) {
    const cacheKey = `${messageId}_${voiceName}`;
    const [state, setState] = useState<PlayerState>(
        audioCache.has(cacheKey) ? 'paused' : 'idle'
    );
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const phaseRef = useRef<number>(0);

    // Canvas 파형 시각화
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const draw = () => {
            if (!ctx || !canvas) return;
            const width = rect.width;
            const height = rect.height;
            const centerY = height / 2;
            ctx.clearRect(0, 0, width, height);

            if (state !== 'playing') {
                // 정지 상태: 플랫 라인
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.strokeStyle = '#10b981';
                ctx.globalAlpha = 0.3;
                ctx.lineWidth = 1.5;
                ctx.stroke();
                return;
            }

            phaseRef.current += 0.12;

            ctx.beginPath();
            ctx.moveTo(0, centerY);
            const points = 60;
            for (let i = 0; i <= points; i++) {
                const x = (i / points) * width;
                const envelope = Math.sin((i / points) * Math.PI);
                const y = centerY +
                    Math.sin(i * 0.25 + phaseRef.current) * 6 * envelope +
                    Math.sin(i * 0.5 - phaseRef.current * 1.5) * 3 * envelope;
                ctx.lineTo(x, y);
            }
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.8;
            ctx.stroke();

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => cancelAnimationFrame(animationRef.current);
    }, [state]);

    // 마운트 시 자동으로 TTS 오디오 생성
    useEffect(() => {
        if (audioCache.has(cacheKey)) {
            setState('paused');
            return;
        }

        let cancelled = false;
        const generate = async () => {
            setState('loading');
            try {
                const base64 = await generateTtsAudio(text, voiceName);
                if (cancelled) return;
                const wavUrl = pcmBase64ToWavUrl(base64);
                audioCache.set(cacheKey, wavUrl);
                setState('paused');
            } catch (err) {
                console.error('[TTS] 오디오 자동 생성 실패:', err);
                if (!cancelled) setState('idle');
            }
        };
        generate();

        return () => { cancelled = true; };
    }, [cacheKey, text, voiceName]);

    const handleClick = async () => {
        // 아직 생성 중이면 무시
        if (state === 'loading' || state === 'idle') return;

        // 재생 중 → 일시정지
        if (state === 'playing') {
            audioRef.current?.pause();
            setState('paused');
            return;
        }

        // 일시정지/준비 완료 → 재생
        if (state === 'paused' && audioCache.has(cacheKey)) {
            if (!audioRef.current) {
                audioRef.current = new Audio(audioCache.get(cacheKey)!);
                audioRef.current.onended = () => setState('paused');
            }
            await audioRef.current.play();
            setState('playing');
        }
    };

    // 컴포넌트 언마운트 시 오디오 정리
    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <div className="tts-player flex items-center gap-2 mt-2 pt-2 border-t border-stone-100">
            <button
                onClick={handleClick}
                disabled={state === 'loading'}
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${state === 'playing'
                    ? 'bg-emerald-500 text-white'
                    : state === 'loading'
                        ? 'bg-stone-200 text-stone-400'
                        : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                    }`}
                title={
                    state === 'playing' ? '일시정지' :
                        state === 'loading' ? '생성 중...' :
                            state === 'paused' ? '다시 재생' : '음성으로 듣기'
                }
            >
                {state === 'loading' ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : state === 'playing' ? (
                    <Pause size={14} />
                ) : state === 'paused' ? (
                    <Play size={14} className="ml-0.5" />
                ) : (
                    <Volume2 size={14} />
                )}
            </button>
            <canvas
                ref={canvasRef}
                className="flex-1 h-5"
                style={{ width: '100%', height: '20px' }}
            />
        </div>
    );
}
