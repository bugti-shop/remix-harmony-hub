import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MapPin, Shield } from 'lucide-react';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface LocationDisclosureDialogProps {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const LocationDisclosureDialog = ({
  open,
  onAccept,
  onDecline,
}: LocationDisclosureDialogProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-lg">
              Background Location Access
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="text-foreground font-semibold text-base">
              Npd collects location data to enable location-based task reminders even when the app is closed or not in use.
            </p>
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="font-medium text-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" /> How your location data is used:
              </p>
              <ul className="list-disc list-inside space-y-1.5 ml-1">
                <li><strong className="text-foreground">What we access:</strong> Your device's precise GPS location (foreground and background)</li>
                <li><strong className="text-foreground">Why we access it:</strong> To trigger location-based task reminders when you enter or exit a geofence area you configured</li>
                <li><strong className="text-foreground">How it is processed:</strong> All location data is processed entirely on your device. We do not transmit, collect, or store your location data on any external server</li>
                <li><strong className="text-foreground">Background usage:</strong> Location is accessed <strong className="text-foreground">in the background (when the app is closed or not in use)</strong> to ensure reminders work even if you are not actively using the app</li>
                <li><strong className="text-foreground">Third-party sharing:</strong> Your location data is <strong className="text-foreground">never</strong> shared with third parties, advertisers, or analytics services</li>
                <li><strong className="text-foreground">User control:</strong> You can disable location reminders at any time from the task settings, which immediately stops all location access. You can also revoke location permissions from your device's system settings</li>
              </ul>
            </div>
            <p>
              By tapping "Allow", you consent to the use of your location data as described above. See our{' '}
              <a href="https://docs.google.com/document/d/1YY5k6mXOKJtiZjEb9ws6Aq7UQbStGy-I/edit?usp=drivesdk&ouid=105643538765333343845&rtpof=true&sd=true" target="_blank" rel="noopener noreferrer" className="text-primary underline">Privacy Policy</a> for more details.
            </p>
          </div>
        </div>
        <AlertDialogFooter className="flex-shrink-0 pt-4 border-t">
          <AlertDialogCancel onClick={onDecline}>
            No Thanks
          </AlertDialogCancel>
          <AlertDialogAction onClick={onAccept}>
            Allow Location Access
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Helper to check if disclosure has been accepted
export const hasAcceptedLocationDisclosure = async (): Promise<boolean> => {
  return await getSetting<boolean>('location_disclosure_accepted', false);
};

export const setLocationDisclosureAccepted = async (accepted: boolean = true): Promise<void> => {
  await setSetting('location_disclosure_accepted', accepted);
};
