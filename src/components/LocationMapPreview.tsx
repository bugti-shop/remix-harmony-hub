import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface LocationMapPreviewProps {
  location: string;
  className?: string;
  showFullMap?: boolean;
  onClose?: () => void;
}

interface GeocodingResult {
  center: [number, number];
  place_name: string;
}

export const LocationMapPreview = ({ 
  location, 
  className, 
  showFullMap = false,
  onClose 
}: LocationMapPreviewProps) => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Load mapbox token with default fallback
  useEffect(() => {
    const loadToken = async () => {
      const { getMapboxToken } = await import('@/utils/mapboxConfig');
      const token = await getMapboxToken();
      setMapboxToken(token);
    };
    loadToken();
  }, []);

  // Geocode location string to coordinates
  useEffect(() => {
    if (!location || !mapboxToken) return;

    const geocodeLocation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${mapboxToken}&limit=1`
        );

        if (!response.ok) {
          throw new Error('Failed to geocode location');
        }

        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const result: GeocodingResult = {
            center: data.features[0].center as [number, number],
            place_name: data.features[0].place_name,
          };
          setCoordinates(result.center);
        } else {
          setError(t('locationMap.locationNotFound'));
        }
      } catch (err) {
        setError(t('locationMap.couldNotFind'));
        console.error('Geocoding error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    geocodeLocation();
  }, [location, mapboxToken, t]);

  // Initialize map when coordinates are available
  useEffect(() => {
    if (!mapContainer.current || !coordinates || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: coordinates,
      zoom: 14,
      interactive: showFullMap,
    });

    // Add marker
    marker.current = new mapboxgl.Marker({ color: '#ec4899' })
      .setLngLat(coordinates)
      .addTo(map.current);

    if (showFullMap) {
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      map.current?.remove();
    };
  }, [coordinates, mapboxToken, showFullMap]);

  const handleSaveToken = async () => {
    if (mapboxToken.trim()) {
      const { setSetting } = await import('@/utils/settingsStorage');
      await setSetting('mapbox_token', mapboxToken.trim());
      setShowTokenInput(false);
      setIsLoading(true);
    }
  };

  const openInMaps = () => {
    if (coordinates) {
      const [lng, lat] = coordinates;
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/search/${encodeURIComponent(location)}`, '_blank');
    }
  };

  if (showTokenInput) {
    return (
      <div className={cn("bg-muted/30 rounded-lg p-4 space-y-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 text-pink-500" />
          <span className="font-medium">{location}</span>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t('locationMap.enterMapboxToken')}{' '}
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
              className="text-xs h-8"
            />
            <Button size="sm" onClick={handleSaveToken} disabled={!mapboxToken.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={openInMaps}
          className="w-full gap-2"
        >
          <ExternalLink className="h-3 w-3" />
          {t('locationMap.openInGoogleMaps')}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("bg-muted/30 rounded-lg p-4 animate-pulse", className)}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-medium">{location}</span>
        </div>
        <div className="h-32 mt-3 bg-muted rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("bg-muted/30 rounded-lg p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-medium">{location}</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={openInMaps}
          className="w-full mt-3 gap-2"
        >
          <ExternalLink className="h-3 w-3" />
          {t('locationMap.openInGoogleMaps')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg overflow-hidden border border-border", className)}>
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-medium truncate">{location}</span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={openInMaps}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title={t('locationMap.openInGoogleMaps')}
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      <div 
        ref={mapContainer} 
        className={cn(
          "w-full",
          showFullMap ? "h-64" : "h-32"
        )}
      />
    </div>
  );
};

export default LocationMapPreview;
