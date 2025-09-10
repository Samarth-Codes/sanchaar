import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import Scheduler from '../pages/Scheduler';

// Mock Leaflet map methods used by the app
vi.stubGlobal('performance', { now: () => Date.now() });

// Minimal mocks to allow render without mounting a real map
vi.mock('leaflet', async () => {
  const setLatLng = vi.fn().mockReturnThis();
  const remove = vi.fn();
  const getElement = vi.fn(() => ({ querySelector: () => ({ textContent: '' }) }));
  const marker = vi.fn(() => ({ addTo: () => ({ setLatLng, getElement, remove }), setLatLng, getElement, remove }));
  return {
    default: {
      map: vi.fn(() => ({ on: vi.fn(), setView: vi.fn(), remove: vi.fn(), getCenter: () => ({ lat: 20, lng: 78 }) })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      latLngBounds: vi.fn(() => ({})),
      featureGroup: vi.fn(() => ({ getBounds: () => ({ getSouth: () => 0, getWest: () => 0, getNorth: () => 0, getEast: () => 0 }) })),
      Control: { extend: vi.fn(() => vi.fn()) },
      circleMarker: vi.fn(() => ({ addTo: vi.fn(), bindTooltip: vi.fn() })),
      polyline: vi.fn(() => ({ addTo: vi.fn(), remove: vi.fn() })),
      marker,
      divIcon: vi.fn(() => ({}))
    }
  };
});

describe('Animation lifecycle (smoke)', () => {
  beforeEach(() => {
    // reset app globals if any
    (window as any).__app = undefined;
  });

  it('renders scheduler without crashing', async () => {
    render(<Scheduler />);
    expect(document.body).toBeTruthy();
  });
});


