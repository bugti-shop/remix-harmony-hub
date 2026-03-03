/**
 * Task Completion Combo System
 *
 * Tracks back-to-back task completions within a 5-minute window.
 * Multiplier: 1x → 2x → 3x → 4x → 5x (max).
 * Bonus XP = base XP × (multiplier × 0.5)  →  at 5x combo the bonus is 2.5× normal.
 * Resets if more than 5 minutes pass between completions.
 */

const COMBO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MULTIPLIER = 5;

let lastCompletionTime: number | null = null;
let currentCombo = 0; // 0 = no combo yet, 1 = first task (no bonus), 2+ = combo active

/**
 * Record a task completion and return the combo state.
 * Call this BEFORE awarding XP so the caller can apply the bonus.
 */
export const recordComboCompletion = (): {
  combo: number;
  multiplier: number;
  bonusXp: number;
  isNewCombo: boolean;
} => {
  const now = Date.now();

  if (lastCompletionTime && now - lastCompletionTime <= COMBO_WINDOW_MS) {
    // Within window → increment combo
    currentCombo = Math.min(currentCombo + 1, MAX_MULTIPLIER);
  } else {
    // Gap too long or first task → reset
    currentCombo = 1;
  }

  lastCompletionTime = now;

  const multiplier = currentCombo >= 2 ? currentCombo : 1;
  // Bonus XP = (multiplier - 1) × 0.5 × base XP (base = 10)
  // At 2x: +5, 3x: +10, 4x: +15, 5x: +20
  const bonusXp = multiplier >= 2 ? (multiplier - 1) * 5 : 0;

  return {
    combo: currentCombo,
    multiplier,
    bonusXp,
    isNewCombo: currentCombo >= 2,
  };
};

/**
 * Get current combo state without recording.
 */
export const getCurrentCombo = (): { combo: number; multiplier: number; isActive: boolean } => {
  const now = Date.now();
  const expired = !lastCompletionTime || now - lastCompletionTime > COMBO_WINDOW_MS;

  if (expired) {
    return { combo: 0, multiplier: 1, isActive: false };
  }

  return {
    combo: currentCombo,
    multiplier: currentCombo >= 2 ? currentCombo : 1,
    isActive: currentCombo >= 2,
  };
};

/**
 * Reset the combo (e.g. on app backgrounding if desired).
 */
export const resetCombo = (): void => {
  currentCombo = 0;
  lastCompletionTime = null;
};
