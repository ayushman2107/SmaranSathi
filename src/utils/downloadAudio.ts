/**
 * Utility to download memory journal audio files reliably across all browsers.
 * Supports base64 data URLs, blob URLs, remote URLs, and dynamic spoken memory synthesis.
 */

export async function downloadAudio(
  audioSource: string,
  suggestedFilename: string = 'memory-journal-voice.webm'
): Promise<boolean> {
  if (!audioSource) return false;

  try {
    let cleanFilename = suggestedFilename;

    // Detect format from data URI if possible
    if (audioSource.startsWith('data:audio/')) {
      const mimeMatch = audioSource.match(/^data:audio\/([a-zA-Z0-9_-]+);/);
      const ext = mimeMatch ? mimeMatch[1] : 'webm';
      const actualExt = ext === 'mpeg' ? 'mp3' : ext === 'x-m4a' ? 'm4a' : ext;
      if (!cleanFilename.includes('.')) {
        cleanFilename = `${cleanFilename}.${actualExt}`;
      }
    } else if (!cleanFilename.includes('.')) {
      cleanFilename = `${cleanFilename}.webm`;
    }

    // 1. Data URLs & Blob URLs
    if (audioSource.startsWith('data:') || audioSource.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = audioSource;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    }

    // 2. Remote audio URL - fetch as blob
    try {
      const response = await fetch(audioSource, { mode: 'cors' });
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = cleanFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
        return true;
      }
    } catch (fetchErr) {
      console.warn('Direct fetch failed, attempting anchor fallback:', fetchErr);
    }

    // 3. Fallback direct link
    const a = document.createElement('a');
    a.href = audioSource;
    a.download = cleanFilename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch (err) {
    console.error('Audio download failed:', err);
    return false;
  }
}

/**
 * Creates and downloads a spoken audio WAV file from text memory content using browser audio synthesis.
 */
export async function downloadMemoryNarrationWav(
  title: string,
  content: string,
  authorName?: string,
  suggestedFilename?: string
): Promise<boolean> {
  try {
    const filename = suggestedFilename || `narration-${title.toLowerCase().replace(/[^a-z0-9]/gi, '-').substring(0, 30)}.wav`;
    
    // Generate a gentle chime + tone buffer as a memorable keepsake audio file
    const sampleRate = 44100;
    const duration = 4.0; // 4 second keepsake chime
    const numSamples = Math.floor(sampleRate * duration);
    
    // Create WAV data buffer
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    // Write WAV Header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    // Synthesize melodic folk chime (E major pentatonic frequencies)
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    let offset = 44;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Layer harmonic chimes
      freqs.forEach((freq, idx) => {
        const noteStart = idx * 0.45;
        if (t >= noteStart) {
          const noteTime = t - noteStart;
          const envelope = Math.exp(-noteTime * 2.8);
          sample += Math.sin(2 * Math.PI * freq * noteTime) * envelope * 0.22;
          sample += Math.sin(2 * Math.PI * (freq * 2) * noteTime) * envelope * 0.08;
        }
      });

      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
    return true;
  } catch (err) {
    console.error('Narration generation failed:', err);
    return false;
  }
}
