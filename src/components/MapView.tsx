import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Station } from '../lib';
// Fix Leaflet default marker asset URLs in bundlers (Vite)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Merge default icon paths once
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - leaflet types may not expose Default fully here
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

type Props = {
  stations: Station[];
  onAddStation: (s: Station) => void;
  onMapReady?: (map: L.Map) => void;
  routes?: Array<[string, string]>;
};

export default function MapView({ stations, onAddStation, onMapReady, routes }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Array<L.Marker | L.CircleMarker>>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const extraRouteLayersRef = useRef<L.Polyline[]>([]);
  const handleKeyPressRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  const userAdjustedViewRef = useRef<boolean>(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!mapRef.current) {
      // Guard against strict-mode re-mounts: if Leaflet already attached, clear it
      if ((el as any)._leaflet_id) {
        el.replaceChildren();
      }
      const map = L.map(el, {
        zoomControl: true,
        minZoom: 4,
        maxZoom: 12,
        maxBounds: L.latLngBounds(
          [6.0, 68.0],  // Southwest corner of India
          [37.0, 97.0]  // Northeast corner of India
        ),
        maxBoundsViscosity: 1.0  // Prevent panning outside India
      }).setView([20.5937, 78.9629], 5);

      // Track user interactions to preserve their zoom/pan
      map.on('zoomstart moveend', () => { userAdjustedViewRef.current = true; });

      // Create zoom to India function
      const zoomToIndia = () => {
        try {
          const indiaBounds = L.latLngBounds([6.0, 68.0], [37.0, 97.0]);
          map.fitBounds(indiaBounds, { padding: [20, 20], animate: true });
        } catch (error) {
          // no-op
        }
      };

      // Add custom zoom to India button
      const zoomToIndiaControl = L.Control.extend({
        onAdd: function() {
          const div = L.DomUtil.create('div', 'leaflet-control-zoom-to-india');
          div.innerHTML = `
            <button title="Zoom to India (Press 'I')" style="
              width: 34px; 
              height: 34px; 
              background: white; 
              border: 2px solid #007cba; 
              border-radius: 4px; 
              cursor: pointer; 
              font-size: 18px; 
              font-weight: bold;
              box-shadow: 0 1px 5px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 2px;
            ">🇮🇳</button>
          `;
          div.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            userAdjustedViewRef.current = false; // allow auto-fit after explicit command
            zoomToIndia();
            return false;
          };
          return div;
        }
      });
      new zoomToIndiaControl({ position: 'topright' }).addTo(map);

      // Keyboard shortcut 'I'
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            userAdjustedViewRef.current = false;
            zoomToIndia();
          }
        }
      };
      handleKeyPressRef.current = handleKeyPress;
      document.addEventListener('keydown', handleKeyPress);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        detectRetina: true
      }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        const name = prompt(`Enter station name for position ${stations.length + 1}:`);
        if (!name) return;
        const s: Station = { id: stations.length + 1, name: name.trim(), lat: e.latlng.lat, lng: e.latlng.lng };
        onAddStation(s);
      });
      mapRef.current = map;
      onMapReady?.(map);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (handleKeyPressRef.current) {
        document.removeEventListener('keydown', handleKeyPressRef.current);
        handleKeyPressRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    stations.forEach(s => {
      const cm = L.circleMarker([s.lat, s.lng], { radius: 6, color: '#22d3ee', weight: 2, fillColor: '#22d3ee', fillOpacity: 1 })
        .addTo(map)
        .bindTooltip(`${s.id}. ${s.name}`, { permanent: false });
      markersRef.current.push(cm);
    });
    // Clear extra layers
    extraRouteLayersRef.current.forEach(l => l.remove());
    extraRouteLayersRef.current = [];
    // Draw and fit only the selected route
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    if (stations.length >= 2) {
      const latlngs = stations.map(s => [s.lat, s.lng]) as any;
      routeLayerRef.current = L.polyline(latlngs, { color: '#22d3ee', weight: 5, opacity: 0.95 }).addTo(map);
      // Remove dotted guide routes for a cleaner map
      if (!userAdjustedViewRef.current) {
        const group = L.featureGroup([routeLayerRef.current, ...markersRef.current, ...extraRouteLayersRef.current]);
        const bounds = group.getBounds();
        const indiaBounds = L.latLngBounds([6.0, 68.0], [37.0, 97.0]);
        const constrainedBounds = L.latLngBounds(
          [
            Math.max(bounds.getSouth(), indiaBounds.getSouth()),
            Math.max(bounds.getWest(), indiaBounds.getWest())
          ],
          [
            Math.min(bounds.getNorth(), indiaBounds.getNorth()),
            Math.min(bounds.getEast(), indiaBounds.getEast())
          ]
        );
        map.fitBounds(constrainedBounds.pad(0.05), { animate: false });
      }
    } else if (markersRef.current.length === 1 && !userAdjustedViewRef.current) {
      const markerLatLng = markersRef.current[0].getLatLng();
      const constrainedLat = Math.max(6.0, Math.min(37.0, markerLatLng.lat));
      const constrainedLng = Math.max(68.0, Math.min(97.0, markerLatLng.lng));
      map.setView([constrainedLat, constrainedLng], 10);
    }
  }, [stations, routes]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
}

