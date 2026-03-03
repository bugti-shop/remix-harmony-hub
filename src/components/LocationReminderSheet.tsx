import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { MapPin, Navigation, Search, X, Bell, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setSetting } from '@/utils/settingsStorage';
import { LocationDisclosureDialog, hasAcceptedLocationDisclosure, setLocationDisclosureAccepted } from '@/components/LocationDisclosureDialog';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface LocationReminder {
  enabled: boolean;
  latitude: number;
  longitude: number;
  address: string;
  radius: number; // in meters
  triggerOnEnter: boolean;
  triggerOnExit: boolean;
}

interface LocationReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  locationReminder?: LocationReminder;
  onSave: (reminder: LocationReminder) => void;
  onRemove: () => void;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

export const LocationReminderSheet = ({
  isOpen,
  onClose,
  locationReminder,
  onSave,
  onRemove,
}: LocationReminderSheetProps) => {
  const [enabled, setEnabled] = useState(locationReminder?.enabled ?? true);
  const [address, setAddress] = useState(locationReminder?.address ?? '');
  const [latitude, setLatitude] = useState(locationReminder?.latitude ?? 0);
  const [longitude, setLongitude] = useState(locationReminder?.longitude ?? 0);
  const [radius, setRadius] = useState(locationReminder?.radius ?? 100);
  const [triggerOnEnter, setTriggerOnEnter] = useState(locationReminder?.triggerOnEnter ?? true);
  const [triggerOnExit, setTriggerOnExit] = useState(locationReminder?.triggerOnExit ?? false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [disclosureChecked, setDisclosureChecked] = useState(false);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const radiusCircle = useRef<string | null>(null);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  // Check if location disclosure has been accepted
  useEffect(() => {
    if (isOpen && !disclosureChecked) {
      hasAcceptedLocationDisclosure().then((accepted) => {
        if (!accepted) {
          setShowDisclosure(true);
        }
        setDisclosureChecked(true);
      });
    }
  }, [isOpen, disclosureChecked]);

  // Load mapbox token with default fallback
  useEffect(() => {
    const loadToken = async () => {
      const { getMapboxToken } = await import('@/utils/mapboxConfig');
      const token = await getMapboxToken();
      setMapboxToken(token);
      setTokenLoaded(true);
    };
    loadToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !isOpen) return;

    mapboxgl.accessToken = mapboxToken;

    const initialCenter: [number, number] = longitude && latitude 
      ? [longitude, latitude] 
      : [0, 0];
    const initialZoom = longitude && latitude ? 14 : 1;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add marker if location exists
    if (longitude && latitude) {
      marker.current = new mapboxgl.Marker({ color: '#ec4899', draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const lngLat = marker.current?.getLngLat();
        if (lngLat) {
          setLongitude(lngLat.lng);
          setLatitude(lngLat.lat);
          reverseGeocode(lngLat.lng, lngLat.lat);
          updateRadiusCircle(lngLat.lng, lngLat.lat);
        }
      });
    }

    // Click to place marker
    map.current.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLongitude(lng);
      setLatitude(lat);
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else if (map.current) {
        marker.current = new mapboxgl.Marker({ color: '#ec4899', draggable: true })
          .setLngLat([lng, lat])
          .addTo(map.current);

        marker.current.on('dragend', () => {
          const lngLat = marker.current?.getLngLat();
          if (lngLat) {
            setLongitude(lngLat.lng);
            setLatitude(lngLat.lat);
            reverseGeocode(lngLat.lng, lngLat.lat);
            updateRadiusCircle(lngLat.lng, lngLat.lat);
          }
        });
      }
      
      reverseGeocode(lng, lat);
      updateRadiusCircle(lng, lat);
    });

    // Add radius circle on load
    map.current.on('load', () => {
      if (longitude && latitude) {
        updateRadiusCircle(longitude, latitude);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [mapboxToken, isOpen]);

  // Update radius circle when radius changes
  useEffect(() => {
    if (longitude && latitude && map.current?.isStyleLoaded()) {
      updateRadiusCircle(longitude, latitude);
    }
  }, [radius]);

  const updateRadiusCircle = (lng: number, lat: number) => {
    if (!map.current) return;

    const sourceId = 'radius-circle';
    
    // Create circle GeoJSON
    const circle = createCircle([lng, lat], radius);
    
    if (map.current.getSource(sourceId)) {
      (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(circle);
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: circle,
      });
      
      map.current.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#ec4899',
          'fill-opacity': 0.15,
        },
      });
      
      map.current.addLayer({
        id: 'radius-stroke',
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#ec4899',
          'line-width': 2,
        },
      });
    }
  };

  const createCircle = (center: [number, number], radiusMeters: number): GeoJSON.Feature => {
    const points = 64;
    const km = radiusMeters / 1000;
    const distanceX = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = km / 110.574;

    const coordinates: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coordinates.push([center[0] + x, center[1] + y]);
    }
    coordinates.push(coordinates[0]);

    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
    };
  };

  const reverseGeocode = async (lng: number, lat: number) => {
    if (!mapboxToken) return;
    
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        setAddress(data.features[0].place_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  const searchLocations = async (query: string) => {
    if (!query.trim() || !mapboxToken) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5`
      );
      const data = await response.json();
      
      if (data.features) {
        setSearchResults(data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        })));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectLocation = (result: SearchResult) => {
    const [lng, lat] = result.center;
    setLongitude(lng);
    setLatitude(lat);
    setAddress(result.place_name);
    setSearchQuery('');
    setSearchResults([]);

    if (map.current) {
      map.current.flyTo({ center: [lng, lat], zoom: 15 });
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ color: '#ec4899', draggable: true })
          .setLngLat([lng, lat])
          .addTo(map.current);

        marker.current.on('dragend', () => {
          const lngLat = marker.current?.getLngLat();
          if (lngLat) {
            setLongitude(lngLat.lng);
            setLatitude(lngLat.lat);
            reverseGeocode(lngLat.lng, lngLat.lat);
            updateRadiusCircle(lngLat.lng, lngLat.lat);
          }
        });
      }
      
      updateRadiusCircle(lng, lat);
    }
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude: lng, latitude: lat } = position.coords;
          setLongitude(lng);
          setLatitude(lat);
          reverseGeocode(lng, lat);
          
          if (map.current) {
            map.current.flyTo({ center: [lng, lat], zoom: 15 });
            
            if (marker.current) {
              marker.current.setLngLat([lng, lat]);
            } else {
              marker.current = new mapboxgl.Marker({ color: '#ec4899', draggable: true })
                .setLngLat([lng, lat])
                .addTo(map.current);

              marker.current.on('dragend', () => {
                const lngLat = marker.current?.getLngLat();
                if (lngLat) {
                  setLongitude(lngLat.lng);
                  setLatitude(lngLat.lat);
                  reverseGeocode(lngLat.lng, lngLat.lat);
                  updateRadiusCircle(lngLat.lng, lngLat.lat);
                }
              });
            }
            
            updateRadiusCircle(lng, lat);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  const handleSave = () => {
    if (!latitude || !longitude) return;
    
    onSave({
      enabled,
      latitude,
      longitude,
      address,
      radius,
      triggerOnEnter,
      triggerOnExit,
    });
    onClose();
  };

  const handleSaveToken = async () => {
    if (mapboxToken.trim()) {
      await setSetting('mapbox_token', mapboxToken.trim());
      setShowTokenInput(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchLocations(searchQuery);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, mapboxToken]);

  return (
    <>
    <LocationDisclosureDialog
      open={showDisclosure}
      onAccept={async () => {
        await setLocationDisclosureAccepted();
        setShowDisclosure(false);
        // Request native location permission via Capacitor (falls back to browser)
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          const status = await Geolocation.requestPermissions();
          console.log('Location permission status:', status);
          if (status.location === 'denied') {
            console.log('Location permission denied by user');
          }
        } catch (err) {
          // Fallback to browser geolocation prompt
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              () => {},
              (e) => console.log('Browser location permission error:', e),
              { enableHighAccuracy: true }
            );
          }
        }
      }}
      onDecline={async () => {
        await setLocationDisclosureAccepted(false);
        setShowDisclosure(false);
        onClose();
      }}
    />
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-pink-500" />
              Location Reminder
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {showTokenInput ? (
            <div className="p-4 space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter your Mapbox public token to use location reminders. Get one at{' '}
                  <a 
                    href="https://mapbox.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    mapbox.com
                  </a>
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="pk.eyJ1Ijo..."
                    value={mapboxToken}
                    onChange={(e) => setMapboxToken(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveToken} disabled={!mapboxToken.trim()}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="p-4 space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for a location..."
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-card border rounded-lg shadow-lg overflow-hidden">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => selectLocation(result)}
                        className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0"
                      >
                        <p className="text-sm font-medium truncate">{result.place_name}</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Current Location Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  className="w-full gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  Use Current Location
                </Button>
              </div>

              {/* Map */}
              <div ref={mapContainer} className="h-48 mx-4 rounded-lg overflow-hidden border" />

              {/* Selected Location */}
              {address && (
                <div className="mx-4 mt-3 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-pink-700 dark:text-pink-300">{address}</p>
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="p-4 space-y-6">
                {/* Radius Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Reminder Radius</Label>
                    <span className="text-sm text-muted-foreground">{radius}m</span>
                  </div>
                  <Slider
                    value={[radius]}
                    onValueChange={([value]) => setRadius(value)}
                    min={50}
                    max={1000}
                    step={50}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>50m</span>
                    <span>500m</span>
                    <span>1km</span>
                  </div>
                </div>

                {/* Trigger Options */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Remind me when I</Label>
                  
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Arrive at location</span>
                    </div>
                    <Switch
                      checked={triggerOnEnter}
                      onCheckedChange={setTriggerOnEnter}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Leave location</span>
                    </div>
                    <Switch
                      checked={triggerOnExit}
                      onCheckedChange={setTriggerOnExit}
                    />
                  </div>
                </div>

                {/* Enable/Disable */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Enable Location Reminder</span>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!showTokenInput && (
          <div className="p-4 border-t space-y-2 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}>
            {locationReminder && (
              <Button
                variant="outline"
                onClick={onRemove}
                className="w-full text-destructive hover:text-destructive"
              >
                Remove Location Reminder
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!latitude || !longitude || (!triggerOnEnter && !triggerOnExit)}
              className="w-full"
            >
              {locationReminder ? 'Update Reminder' : 'Set Location Reminder'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
};
