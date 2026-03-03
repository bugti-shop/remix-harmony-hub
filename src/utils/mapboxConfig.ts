// Default Mapbox public token (publishable key - safe to store in code)
export const DEFAULT_MAPBOX_TOKEN = 'pk.eyJ1IjoiYnVndGlzaG9wIiwiYSI6ImNtbG5weHpzNzByejczZ3M2cWcwZHl2ZHgifQ.aoMONfrYYEVotNkXb5_q-A';

/**
 * Get the Mapbox token - checks settings first, falls back to default
 */
export const getMapboxToken = async (): Promise<string> => {
  try {
    const { getSetting } = await import('@/utils/settingsStorage');
    const storedToken = await getSetting<string | null>('mapbox_token', null);
    if (storedToken) return storedToken;
  } catch {}
  return DEFAULT_MAPBOX_TOKEN;
};
