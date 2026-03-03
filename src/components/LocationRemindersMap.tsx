import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TodoItem } from '@/types/note';
import { MapPin, X, Navigation, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface LocationRemindersMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TodoItem[];
  onTaskClick?: (task: TodoItem) => void;
}

export const LocationRemindersMap = ({
  open,
  onOpenChange,
  tasks,
  onTaskClick,
}: LocationRemindersMapProps) => {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Filter tasks with location reminders
  const tasksWithLocation = useMemo(() => 
    tasks.filter(
      (task) =>
        !task.completed &&
        task.locationReminder?.enabled &&
        task.locationReminder.latitude &&
        task.locationReminder.longitude
    ),
    [tasks]
  );

  useEffect(() => {
    const loadToken = async () => {
      const { getMapboxToken } = await import('@/utils/mapboxConfig');
      const token = await getMapboxToken();
      setMapboxToken(token);
    };
    loadToken();
  }, []);

  useEffect(() => {
    if (!open || !mapboxToken || !mapContainerRef.current || tasksWithLocation.length === 0) return;

    mapboxgl.accessToken = mapboxToken;

    // Initialize map centered on first task location
    const firstTask = tasksWithLocation[0];
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [firstTask.locationReminder!.longitude, firstTask.locationReminder!.latitude],
      zoom: 12,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add markers for all tasks
      tasksWithLocation.forEach((task) => {
        if (!task.locationReminder) return;

        const el = document.createElement('div');
        el.className = 'location-marker';
        el.style.width = '40px';
        el.style.height = '40px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = 'hsl(var(--primary))';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.cursor = 'pointer';
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="padding: 8px; max-width: 200px;">
            <strong style="font-size: 14px;">${task.text}</strong>
            <p style="font-size: 12px; color: #666; margin-top: 4px;">
              ${task.locationReminder.address.split(',')[0]}
            </p>
            <p style="font-size: 11px; color: #888; margin-top: 4px;">
              Radius: ${task.locationReminder.radius}m
              ${task.locationReminder.triggerOnEnter ? '• ' + t('locationMap.enter') : ''}
              ${task.locationReminder.triggerOnExit ? '• ' + t('locationMap.exit') : ''}
            </p>
          </div>
        `);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([task.locationReminder.longitude, task.locationReminder.latitude])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          onTaskClick?.(task);
        });

        // Add radius circle
        map.addSource(`radius-${task.id}`, {
          type: 'geojson',
          data: createCircle(
            [task.locationReminder.longitude, task.locationReminder.latitude],
            task.locationReminder.radius
          ),
        });

        map.addLayer({
          id: `radius-${task.id}`,
          type: 'fill',
          source: `radius-${task.id}`,
          paint: {
            'fill-color': 'hsl(var(--primary))',
            'fill-opacity': 0.15,
          },
        });

        map.addLayer({
          id: `radius-border-${task.id}`,
          type: 'line',
          source: `radius-${task.id}`,
          paint: {
            'line-color': 'hsl(var(--primary))',
            'line-width': 2,
            'line-opacity': 0.5,
          },
        });

        markersRef.current.push(marker);
      });

      // Fit map to show all markers
      if (tasksWithLocation.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        tasksWithLocation.forEach((task) => {
          if (task.locationReminder) {
            bounds.extend([task.locationReminder.longitude, task.locationReminder.latitude]);
          }
        });
        map.fitBounds(bounds, { padding: 50 });
      }
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
    };
  }, [open, mapboxToken, tasksWithLocation, onTaskClick]);

  const createCircle = (center: [number, number], radiusInMeters: number) => {
    const points = 64;
    const km = radiusInMeters / 1000;
    const coords: number[][] = [];
    const distanceX = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = km / 110.574;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]);

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coords],
      },
      properties: {},
    };
  };

  const handleSaveToken = async () => {
    if (tokenInput.trim()) {
      const { setSetting } = await import('@/utils/settingsStorage');
      await setSetting('mapbox_token', tokenInput.trim());
      setMapboxToken(tokenInput.trim());
      setShowTokenInput(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t('locationMap.title')} ({tasksWithLocation.length})
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        {showTokenInput ? (
          <div className="p-6 space-y-4">
            <p className="text-muted-foreground">
              {t('locationMap.enterToken')}
            </p>
            <Input
              placeholder="pk.eyJ..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <Button onClick={handleSaveToken} className="w-full">
              {t('locationMap.saveToken')}
            </Button>
          </div>
        ) : tasksWithLocation.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-4 opacity-50" />
            <p>{t('locationMap.noReminders')}</p>
            <p className="text-sm">{t('locationMap.noRemindersDesc')}</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div ref={mapContainerRef} className="flex-1" />
            
            {/* Task list */}
            <div className="border-t max-h-48 overflow-y-auto">
              {tasksWithLocation.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 border-b hover:bg-muted/50 cursor-pointer"
                  onClick={() => onTaskClick?.(task)}
                >
                  <MapPin className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.text}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {task.locationReminder?.address}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (task.locationReminder) {
                        window.open(
                          `https://www.google.com/maps?q=${task.locationReminder.latitude},${task.locationReminder.longitude}`,
                          '_blank'
                        );
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
