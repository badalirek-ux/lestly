// components/GoogleMap.jsx
// Mappa Google Maps riutilizzabile.
// Props:
//   apiKey        - Google Maps API key
//   center        - { lat, lng } centro mappa
//   zoom          - zoom iniziale (default 13)
//   riderMarkers  - [{ riderId, name, lat, lng }] marker rider (pannello ristorante)
//   myPosition    - { lat, lng } posizione del rider loggato
//   destination   - { lat, lng, label } destinazione consegna
//   showRoute     - bool, disegna percorso da myPosition a destination

import { useEffect, useRef, useState } from 'react';

const MAPS_SCRIPT_ID = 'gmaps-script';

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) return resolve(window.google.maps);
    if (document.getElementById(MAPS_SCRIPT_ID)) {
      // Script già in caricamento, aspetta
      const interval = setInterval(() => {
        if (window.google?.maps) { clearInterval(interval); resolve(window.google.maps); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id  = MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=directions`;
    script.async = true;
    script.onload  = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Google Maps non caricato'));
    document.head.appendChild(script);
  });
}

const DARK_STYLE = [
  { elementType: 'geometry',   stylers: [{ color: '#1a1e28' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#13161d' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8b91a8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252a38' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0d0f14' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2f3547' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d0f14' }] },
  { featureType: 'poi',   stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function GoogleMap({
  apiKey,
  center,
  zoom = 13,
  riderMarkers = [],
  myPosition   = null,
  destination  = null,
  showRoute    = false,
  style        = {}
}) {
  const mapRef       = useRef(null);
  const mapObj       = useRef(null);
  const markersRef   = useRef([]);
  const routeRef     = useRef(null);
  const [error, setError] = useState(null);

  // Carica script e inizializza mappa
  useEffect(() => {
    if (!apiKey) { setError('API key Google Maps mancante'); return; }
    loadGoogleMaps(apiKey).then((gmaps) => {
      if (!mapRef.current || mapObj.current) return;
      mapObj.current = new gmaps.Map(mapRef.current, {
        center:    center || { lat: 41.9028, lng: 12.4964 }, // Roma default
        zoom,
        styles:    DARK_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy'
      });
    }).catch(err => setError(err.message));
  }, [apiKey]);

  // Aggiorna marker rider (pannello ristorante)
  useEffect(() => {
    if (!mapObj.current || !window.google) return;
    // Rimuovi vecchi marker
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    riderMarkers.forEach(r => {
      const marker = new window.google.maps.Marker({
        position: { lat: r.lat, lng: r.lng },
        map: mapObj.current,
        title: r.name || r.riderId,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ff6b2b',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2
        },
        label: { text: '🛵', fontSize: '18px' }
      });
      const iw = new window.google.maps.InfoWindow({
        content: `<div style="color:#000;font-weight:bold">${r.name || r.riderId}</div>`
      });
      marker.addListener('click', () => iw.open(mapObj.current, marker));
      markersRef.current.push(marker);
    });
  }, [riderMarkers]);

  // Marker posizione rider loggato
  useEffect(() => {
    if (!mapObj.current || !window.google || !myPosition) return;
    new window.google.maps.Marker({
      position: myPosition,
      map: mapObj.current,
      title: 'La tua posizione',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2
      }
    });
    mapObj.current.panTo(myPosition);
  }, [myPosition?.lat, myPosition?.lng]);

  // Marker destinazione
  useEffect(() => {
    if (!mapObj.current || !window.google || !destination) return;
    new window.google.maps.Marker({
      position: destination,
      map: mapObj.current,
      title: destination.label || 'Destinazione',
      icon: {
        path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 5,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 1
      }
    });
  }, [destination]);

  // Percorso da myPosition a destination
  useEffect(() => {
    if (!mapObj.current || !window.google || !showRoute || !myPosition || !destination) return;
    if (routeRef.current) routeRef.current.setMap(null);
    const ds = new window.google.maps.DirectionsService();
    const dr = new window.google.maps.DirectionsRenderer({
      map: mapObj.current,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#ff6b2b', strokeWeight: 4 }
    });
    ds.route({
      origin:      myPosition,
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode:  window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK') dr.setDirections(result);
    });
    routeRef.current = dr;
  }, [showRoute, myPosition?.lat, myPosition?.lng, destination]);

  if (error) return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: '0.85rem', ...style
    }}>
      🗺 {error}
    </div>
  );

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: 320, borderRadius: 'var(--radius)', overflow: 'hidden', ...style }}
    />
  );
}
