import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocationReminder } from '@/types/note';
import { MapPin, Navigation, Search, X, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
}

interface LocationSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: LocationReminder) => void;
  locationReminder?: LocationReminder;
  onClear: () => void;
  className?: string;
}

export const LocationSearchInput = ({
  value,
  onChange,
  onLocationSelect,
  locationReminder,
  onClear,
  className,
}: LocationSearchInputProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Get mapbox token with default fallback
  useEffect(() => {
    const loadToken = async () => {
      const { getMapboxToken } = await import('@/utils/mapboxConfig');
      const token = await getMapboxToken();
      setMapboxToken(token);
    };
    loadToken();
  }, []);

  // Search locations
  useEffect(() => {
    if (!searchQuery.trim() || !mapboxToken) {
      setSearchResults([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&limit=12&types=poi,address,place,locality,neighborhood,region,postcode,district&language=en`
        );
        const data = await response.json();
        
        if (data.features) {
          setSearchResults(data.features.map((f: any) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          })));
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, mapboxToken]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLocation = (result: SearchResult) => {
    const [lng, lat] = result.center;
    onChange(result.place_name);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);

    onLocationSelect({
      enabled: true,
      latitude: lat,
      longitude: lng,
      address: result.place_name,
      radius: 100,
      triggerOnEnter: true,
      triggerOnExit: false,
    });
  };

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { longitude: lng, latitude: lat } = position.coords;
          
          // Reverse geocode to get address
          if (mapboxToken) {
            try {
              const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}`
              );
              const data = await response.json();
              
              if (data.features && data.features.length > 0) {
                const address = data.features[0].place_name;
                onChange(address);
                onLocationSelect({
                  enabled: true,
                  latitude: lat,
                  longitude: lng,
                  address,
                  radius: 100,
                  triggerOnEnter: true,
                  triggerOnExit: false,
                });
              }
            } catch (error) {
              console.error('Reverse geocoding error:', error);
            }
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  if (!mapboxToken) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-pink-500" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter location..."
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Add your Mapbox token in settings to enable location search
        </p>
      </div>
    );
  }

  // Show selected location with reminder options
  if (locationReminder?.enabled) {
    return (
      <div className={cn("bg-pink-50 dark:bg-pink-950/20 rounded-lg p-3", className)}>
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-pink-700 dark:text-pink-300 truncate">
              {locationReminder.address.split(',')[0]}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-pink-600/70 dark:text-pink-400/70">
                {locationReminder.radius}m radius
              </span>
              <span className="text-xs text-pink-600/70 dark:text-pink-400/70">•</span>
              <span className="text-xs text-pink-600/70 dark:text-pink-400/70 flex items-center gap-1">
                {locationReminder.triggerOnEnter && (
                  <span className="flex items-center gap-0.5">
                    <ArrowRight className="h-3 w-3" /> Arrive
                  </span>
                )}
                {locationReminder.triggerOnEnter && locationReminder.triggerOnExit && ' / '}
                {locationReminder.triggerOnExit && (
                  <span className="flex items-center gap-0.5">
                    <ArrowLeft className="h-3 w-3" /> Leave
                  </span>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={onClear}
            className="p-1 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded transition-colors"
          >
            <X className="h-4 w-4 text-pink-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery || value}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) onChange('');
            }}
            onFocus={() => searchQuery && setShowResults(true)}
            placeholder="Search location for reminder..."
            className="pl-10 pr-10"
          />
          {(searchQuery || value) && (
            <button
              onClick={() => { 
                setSearchQuery(''); 
                setSearchResults([]); 
                onChange('');
                setShowResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={getCurrentLocation}
          className="flex-shrink-0"
        >
          <Navigation className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
          {searchResults.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => selectLocation(result)}
              className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0 flex items-start gap-2"
            >
              <MapPin className="h-4 w-4 text-pink-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{result.place_name}</p>
            </button>
          ))}
        </div>
      )}

      {isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 p-4 text-center text-sm text-muted-foreground">
          Searching...
        </div>
      )}
    </div>
  );
};
