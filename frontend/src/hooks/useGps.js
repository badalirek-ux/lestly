// hooks/useGps.js
// Invia la posizione GPS del rider al backend ogni N secondi

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const API = "http://127.0.0.1:8000/api";
const INTERVAL_MS = 5000; // ogni 5 secondi

export function useGps(riderId, active = true) {
  const [position, setPosition] = useState(null);
  const [error, setError]       = useState(null);
  const watchRef                = useRef(null);
  const timerRef                = useRef(null);
  const latestPos               = useRef(null);

  useEffect(() => {
    if (!active || !riderId) return;
    if (!navigator.geolocation) {
      setError('GPS non supportato dal browser');
      return;
    }

    // Watch posizione in tempo reale
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(coords);
        latestPos.current = coords;
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    // Invia al backend ogni INTERVAL_MS
    timerRef.current = setInterval(async () => {
      if (!latestPos.current) return;
      try {
        await axios.post(`${API}/gps/update`, {
          riderId,
          lat: latestPos.current.lat,
          lng: latestPos.current.lng
        });
      } catch {}
    }, INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchRef.current);
      clearInterval(timerRef.current);
    };
  }, [riderId, active]);

  return { position, error };
}
