/**
 * PCM base64 오디오 데이터를 WAV Blob URL로 변환하는 유틸리티.
 * Gemini TTS API는 raw PCM (Linear16, 24kHz, mono) 형식의 오디오를 반환합니다.
 */

export function pcmBase64ToWavUrl(base64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
    const binaryString = atob(base64);
    const pcmLength = binaryString.length;
    const wavLength = 44 + pcmLength;

    const buffer = new ArrayBuffer(wavLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, wavLength - 8, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Sub-chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true); // Byte rate
    view.setUint16(32, numChannels * bitsPerSample / 8, true); // Block align
    view.setUint16(34, bitsPerSample, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmLength, true);

    // Write PCM data
    const uint8Array = new Uint8Array(buffer, 44);
    for (let i = 0; i < pcmLength; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
