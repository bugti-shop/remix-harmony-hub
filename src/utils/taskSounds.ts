// Task completion sound utility - like Todoist
import { getSetting, setSetting } from '@/utils/settingsStorage';

// Base64 encoded completion sound (a pleasant "ding" sound)
const COMPLETION_SOUND_BASE64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYQrF1GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQZAAP8AAAaQAAAAgAAA0gAAABAAAAGkAAAAIAAANIAAAAQAAANIAAAAQRMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';

let completionAudio: HTMLAudioElement | null = null;
let soundEnabled = true;
let soundInitialized = false;

// Initialize the audio element
const initAudio = () => {
  if (!completionAudio) {
    completionAudio = new Audio(COMPLETION_SOUND_BASE64);
    completionAudio.volume = 0.5;
  }
};

// Initialize settings from IndexedDB
const initSettings = async () => {
  if (soundInitialized) return;
  soundInitialized = true;
  soundEnabled = await getSetting<boolean>('taskCompletionSound', true);
};

// Call init on module load
initSettings();

// Alternative: Create a programmatic completion sound using Web Audio API
const createCompletionSound = (): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create a pleasant "ding" sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Pleasant bell-like frequency
    oscillator.frequency.setValueAtTime(830, audioContext.currentTime); // G#5
    oscillator.type = 'sine';
    
    // Quick fade in and out for a "ding" effect
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Add a second harmonic for richness
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.frequency.setValueAtTime(1245, audioContext.currentTime); // E6
    oscillator2.type = 'sine';
    
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.01);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    
    oscillator2.start(audioContext.currentTime);
    oscillator2.stop(audioContext.currentTime + 0.25);
    
    // Cleanup
    setTimeout(() => {
      audioContext.close();
    }, 500);
  } catch (error) {
    console.error('Error playing completion sound:', error);
  }
};

/**
 * Play the task completion sound
 */
export const playCompletionSound = (): void => {
  if (!soundEnabled) return;
  
  // Use Web Audio API for a more reliable cross-platform sound
  createCompletionSound();
};

/**
 * Enable or disable completion sounds
 */
export const setCompletionSoundEnabled = (enabled: boolean): void => {
  soundEnabled = enabled;
  setSetting('taskCompletionSound', enabled);
};

/**
 * Check if completion sound is enabled
 */
export const isCompletionSoundEnabled = async (): Promise<boolean> => {
  soundEnabled = await getSetting<boolean>('taskCompletionSound', true);
  return soundEnabled;
};

/**
 * Set the completion sound volume (0-1)
 */
export const setCompletionSoundVolume = (volume: number): void => {
  initAudio();
  if (completionAudio) {
    completionAudio.volume = Math.max(0, Math.min(1, volume));
  }
  setSetting('taskCompletionVolume', volume);
};
