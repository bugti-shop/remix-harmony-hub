import { TodoItem, LocationReminder } from '@/types/note';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface GeofenceState {
  taskId: string;
  wasInside: boolean;
  lastCheckTime: number;
}

const geofenceStates: Map<string, GeofenceState> = new Map();

export const calculateDistance = (
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const isInsideGeofence = (
  userLat: number,
  userLon: number,
  locationReminder: LocationReminder
): boolean => {
  const distance = calculateDistance(
    userLat,
    userLon,
    locationReminder.latitude,
    locationReminder.longitude
  );
  return distance <= locationReminder.radius;
};

// Send local notification when geofence is triggered
const sendLocalNotification = async (
  task: TodoItem,
  isEntering: boolean
): Promise<void> => {
  const locationName = task.locationReminder?.address.split(',')[0] || 'Location';
  const action = isEntering ? 'Arrived at' : 'Left';
  const body = `${action} ${locationName} — "${task.text}"`;

  try {
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    
    // Request permission if needed
    const permResult = await LocalNotifications.checkPermissions();
    if (permResult.display !== 'granted') {
      const reqResult = await LocalNotifications.requestPermissions();
      if (reqResult.display !== 'granted') {
        console.warn('Local notification permission denied');
        return;
      }
    }

    await LocalNotifications.schedule({
      notifications: [{
        title: isEntering ? '📍 Location Reminder' : '📍 Leaving Area',
        body,
        id: Math.floor(Math.random() * 100000),
        schedule: { at: new Date(Date.now() + 100) }, // Near-immediate
        sound: undefined,
        extra: { taskId: task.id, type: 'geofence' },
      }],
    });
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('not implemented') || msg.includes('not available')) return;
    // Fallback: browser Notification API
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(isEntering ? '📍 Location Reminder' : '📍 Leaving Area', {
          body,
          icon: '/nota-logo.png',
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification(isEntering ? '📍 Location Reminder' : '📍 Leaving Area', {
            body,
            icon: '/nota-logo.png',
          });
        }
      }
    } catch {}
  }
};

export const triggerGeofenceNotification = async (
  task: TodoItem,
  isEntering: boolean
): Promise<void> => {
  if (!task.locationReminder) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {}

  // Send actual notification
  await sendLocalNotification(task, isEntering);

  // Also dispatch in-app event
  const locationName = task.locationReminder.address.split(',')[0] || 'Location';
  const action = isEntering ? 'Arrived at' : 'Left';
  
  window.dispatchEvent(new CustomEvent('geofenceTriggered', {
    detail: { taskId: task.id, text: task.text, locationName, action },
  }));
  
  console.log(`[Geofence] Notification sent for task: ${task.text} (${action} ${locationName})`);
};

export const checkGeofences = async (
  tasks: TodoItem[],
  userLat: number,
  userLon: number
): Promise<void> => {
  const tasksWithLocation = tasks.filter(
    (task) => 
      !task.completed && 
      task.locationReminder?.enabled &&
      task.locationReminder.latitude &&
      task.locationReminder.longitude
  );

  for (const task of tasksWithLocation) {
    if (!task.locationReminder) continue;

    const isInside = isInsideGeofence(userLat, userLon, task.locationReminder);
    const state = geofenceStates.get(task.id);

    if (!state) {
      geofenceStates.set(task.id, {
        taskId: task.id,
        wasInside: isInside,
        lastCheckTime: Date.now(),
      });
      continue;
    }

    if (isInside !== state.wasInside) {
      const isEntering = isInside;
      const isExiting = !isInside;

      if (isEntering && task.locationReminder.triggerOnEnter) {
        await triggerGeofenceNotification(task, true);
      } else if (isExiting && task.locationReminder.triggerOnExit) {
        await triggerGeofenceNotification(task, false);
      }

      geofenceStates.set(task.id, {
        ...state,
        wasInside: isInside,
        lastCheckTime: Date.now(),
      });
    }
  }
};

let watchId: number | null = null;
let isWatching = false;

export const startGeofenceWatching = (
  getTasksFn: () => TodoItem[]
): (() => void) => {
  if (isWatching) return () => {};

  if (!('geolocation' in navigator)) {
    console.warn('Geolocation not supported');
    return () => {};
  }

  isWatching = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const tasks = getTasksFn();
      checkGeofences(tasks, position.coords.latitude, position.coords.longitude);
    },
    (error) => console.warn('Initial geolocation error:', error),
    { enableHighAccuracy: true }
  );

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const tasks = getTasksFn();
      checkGeofences(tasks, position.coords.latitude, position.coords.longitude);
    },
    (error) => {
      console.warn('Geolocation watch error:', error);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 10000,
    }
  );

  console.log('Started geofence watching');

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isWatching = false;
    geofenceStates.clear();
    console.log('Stopped geofence watching');
  };
};

export const hasLocationReminders = (tasks: TodoItem[]): boolean => {
  return tasks.some(
    (task) => 
      !task.completed && 
      task.locationReminder?.enabled
  );
};

export const clearGeofenceState = (taskId: string): void => {
  geofenceStates.delete(taskId);
};

export const clearAllGeofenceStates = (): void => {
  geofenceStates.clear();
};
