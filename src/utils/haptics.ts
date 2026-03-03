import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Priority } from '@/types/note';

export type HapticIntensity = 'light' | 'medium' | 'heavy';

export const triggerHaptic = async (style: HapticIntensity = 'heavy') => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let impactStyle: ImpactStyle;
    
    switch (style) {
      case 'light':
        impactStyle = ImpactStyle.Light;
        break;
      case 'medium':
        impactStyle = ImpactStyle.Medium;
        break;
      case 'heavy':
      default:
        impactStyle = ImpactStyle.Heavy;
        break;
    }
    
    await Haptics.impact({ style: impactStyle });
  } catch (error) {
    console.log('Haptics not available:', error);
  }
};

// Triple heavy haptic burst for maximum attention on reminders
export const triggerTripleHeavyHaptic = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Three heavy bursts in quick succession for urgent attention
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await new Promise(resolve => setTimeout(resolve, 80));
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await new Promise(resolve => setTimeout(resolve, 80));
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.log('Haptics not available:', error);
  }
};

// Priority-based haptic feedback for notifications
export const triggerPriorityHaptic = async (priority?: Priority) => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    switch (priority) {
      case 'high':
        // Heavy haptics - multiple strong vibrations for urgency
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 100));
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'medium':
        // Medium haptics - two medium vibrations
        await Haptics.impact({ style: ImpactStyle.Medium });
        await new Promise(resolve => setTimeout(resolve, 150));
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'low':
        // Light haptic - single light vibration
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      default:
        // Default to medium for no priority set
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
    }
  } catch (error) {
    console.log('Haptics not available:', error);
  }
};

// Notification haptic based on notification type
export const triggerNotificationHaptic = async (type: 'success' | 'warning' | 'error' = 'success') => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let notificationType: NotificationType;
    
    switch (type) {
      case 'success':
        notificationType = NotificationType.Success;
        break;
      case 'warning':
        notificationType = NotificationType.Warning;
        break;
      case 'error':
        notificationType = NotificationType.Error;
        break;
    }
    
    await Haptics.notification({ type: notificationType });
  } catch (error) {
    console.log('Haptics not available:', error);
  }
};
