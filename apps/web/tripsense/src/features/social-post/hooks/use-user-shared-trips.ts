import { useState, useEffect } from 'react';
import type { TripResponse } from '@/features/trip-management/types';
import { getSharedTrips } from '@/features/trip-management/services/trip-management-api';

export function useUserSharedTrips(userId: string) {
  const [trips, setTrips] = useState<TripResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    
    getSharedTrips(userId)
      .then(response => {
        if (mounted) {
          setTrips(response.content);
          setIsLoading(false);
        }
      })
      .catch(error => {
        console.error('Error fetching shared trips:', error);
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return { trips, isLoading };
}
