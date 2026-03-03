// Audio Effects Utility for Voice Recordings
// Provides noise reduction and volume normalization

export interface AudioEffectOptions {
  noiseReduction?: boolean;
  noiseThreshold?: number; // 0-1, default 0.02
  normalize?: boolean;
  targetPeak?: number; // 0-1, default 0.9
  compressor?: boolean;
  highPassFilter?: boolean;
  highPassFrequency?: number; // Hz, default 80
}

/**
 * Apply audio effects to a voice recording
 * @param audioUrl - Base64 or URL of the audio
 * @param options - Effect options to apply
 * @returns Promise with processed audio base64 URL
 */
export async function applyAudioEffects(
  audioUrl: string,
  options: AudioEffectOptions = {}
): Promise<string> {
  const {
    noiseReduction = true,
    noiseThreshold = 0.02,
    normalize = true,
    targetPeak = 0.9,
    compressor = true,
    highPassFilter = true,
    highPassFrequency = 80,
  } = options;

  try {
    // Fetch and decode the audio
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Create source from the audio buffer
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    
    let currentNode: AudioNode = source;
    
    // Apply high-pass filter to remove low-frequency rumble
    if (highPassFilter) {
      const highPass = offlineContext.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = highPassFrequency;
      highPass.Q.value = 0.7;
      currentNode.connect(highPass);
      currentNode = highPass;
    }
    
    // Apply compressor for consistent volume
    if (compressor) {
      const comp = offlineContext.createDynamicsCompressor();
      comp.threshold.value = -24;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      currentNode.connect(comp);
      currentNode = comp;
    }
    
    // Connect to destination
    currentNode.connect(offlineContext.destination);
    source.start(0);
    
    // Render the processed audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Apply software-based effects (noise reduction and normalization)
    let processedBuffer = renderedBuffer;
    
    if (noiseReduction) {
      processedBuffer = applyNoiseReduction(processedBuffer, noiseThreshold);
    }
    
    if (normalize) {
      processedBuffer = applyNormalization(processedBuffer, targetPeak);
    }
    
    // Convert to WAV
    const wavBlob = audioBufferToWav(processedBuffer);
    
    // Convert to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(wavBlob);
    });
  } catch (error) {
    console.error('Error applying audio effects:', error);
    throw error;
  }
}

/**
 * Simple noise gate - reduces samples below threshold to near-silence
 */
function applyNoiseReduction(buffer: AudioBuffer, threshold: number): AudioBuffer {
  const audioContext = new AudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);
    
    // Calculate noise floor from quiet sections
    const sortedAmplitudes = Array.from(inputData)
      .map(Math.abs)
      .sort((a, b) => a - b);
    
    // Estimate noise floor from bottom 10% of samples
    const noiseFloorIndex = Math.floor(sortedAmplitudes.length * 0.1);
    const estimatedNoiseFloor = sortedAmplitudes[noiseFloorIndex] || threshold;
    const effectiveThreshold = Math.max(threshold, estimatedNoiseFloor * 1.5);
    
    // Apply noise gate with smooth transition
    const attackTime = 0.001 * buffer.sampleRate; // 1ms attack
    const releaseTime = 0.05 * buffer.sampleRate; // 50ms release
    let envelope = 0;
    
    for (let i = 0; i < inputData.length; i++) {
      const absValue = Math.abs(inputData[i]);
      
      // Envelope follower
      if (absValue > envelope) {
        envelope = envelope + (absValue - envelope) / attackTime;
      } else {
        envelope = envelope + (absValue - envelope) / releaseTime;
      }
      
      // Apply gate
      if (envelope < effectiveThreshold) {
        // Reduce noise but don't completely silence to avoid artifacts
        outputData[i] = inputData[i] * 0.1;
      } else {
        outputData[i] = inputData[i];
      }
    }
  }
  
  audioContext.close();
  return newBuffer;
}

/**
 * Normalize audio to target peak level
 */
function applyNormalization(buffer: AudioBuffer, targetPeak: number): AudioBuffer {
  const audioContext = new AudioContext();
  const newBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  
  // Find the current peak across all channels
  let maxPeak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const absValue = Math.abs(channelData[i]);
      if (absValue > maxPeak) {
        maxPeak = absValue;
      }
    }
  }
  
  // Calculate gain factor
  const gain = maxPeak > 0 ? targetPeak / maxPeak : 1;
  
  // Apply gain to all channels
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const inputData = buffer.getChannelData(channel);
    const outputData = newBuffer.getChannelData(channel);
    
    for (let i = 0; i < inputData.length; i++) {
      // Apply gain with soft clipping to prevent harsh distortion
      let sample = inputData[i] * gain;
      
      // Soft clip if exceeding target
      if (Math.abs(sample) > 1) {
        sample = Math.sign(sample) * (1 - Math.exp(-Math.abs(sample)));
      }
      
      outputData[i] = sample;
    }
  }
  
  audioContext.close();
  return newBuffer;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Quick presets for common use cases
 */
export const AUDIO_PRESETS = {
  voiceClean: {
    noiseReduction: true,
    noiseThreshold: 0.02,
    normalize: true,
    targetPeak: 0.9,
    compressor: true,
    highPassFilter: true,
    highPassFrequency: 80,
  } as AudioEffectOptions,
  
  voiceNatural: {
    noiseReduction: true,
    noiseThreshold: 0.015,
    normalize: true,
    targetPeak: 0.85,
    compressor: false,
    highPassFilter: true,
    highPassFrequency: 60,
  } as AudioEffectOptions,
  
  normalizeOnly: {
    noiseReduction: false,
    normalize: true,
    targetPeak: 0.9,
    compressor: false,
    highPassFilter: false,
  } as AudioEffectOptions,
  
  noiseReductionOnly: {
    noiseReduction: true,
    noiseThreshold: 0.025,
    normalize: false,
    compressor: false,
    highPassFilter: true,
    highPassFrequency: 100,
  } as AudioEffectOptions,
};
