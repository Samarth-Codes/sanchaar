// RailRadar API client (browser-only)
// Uses Vite env vars:
// - VITE_RAILRADAR_BASE (e.g. https://railradar.in/api/v1)
// - VITE_RAILRADAR_KEY  (your API key)

export interface StationSearchItem {
  code: string;
  name: string;
  lat?: number;
  lng?: number;
}
export type StationSearchResponse = StationSearchItem[];

export interface TrainSearchItem {
  trainNumber: string;
  name: string;
  type: string; // EXPRESS | LOCAL | FREIGHT | ...
}
export type TrainSearchResponse = TrainSearchItem[];

export interface TrainScheduleStop {
  stationCode: string;
  stationName: string;
  arrival: string | null;   // HH:MM
  departure: string | null; // HH:MM
}
export interface TrainScheduleResponse {
  trainNumber: string;
  journeyDate: string; // YYYY-MM-DD
  stops: TrainScheduleStop[];
}

export interface LiveTrain {
  trainNumber: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  lastStation?: string;
  nextStation?: string;
  delayMin?: number;
}
export type LiveMapResponse = LiveTrain[];

export interface AverageDelayResponse {
  trainNumber: string;
  avgArrivalDelayMin: number;
  avgDepartureDelayMin: number;
}

export interface StationLiveResponse {
  stationCode: string;
  arrivals: Array<{ trainNumber: string; due: string; delayMin: number }>;
  departures: Array<{ trainNumber: string; due: string; delayMin: number }>;
}

function getBase(): string {
  const useProxy = ((import.meta as any).env?.VITE_USE_PROXY as string | undefined)?.toLowerCase() !== 'false';
  const isLocal = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/.test(window.location.hostname);
  if (isLocal && useProxy) {
    // Use Vite dev proxy to avoid CORS during local development
    return '';
  }
  const base = (import.meta as any).env?.VITE_RAILRADAR_BASE as string | undefined;
  if (!base) throw new Error('VITE_RAILRADAR_BASE is not set');
  return base.replace(/\/$/, '');
}

function getKey(): string {
  const key = (import.meta as any).env?.VITE_RAILRADAR_KEY as string | undefined;
  if (!key) throw new Error('VITE_RAILRADAR_KEY is not set');
  return key;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    headers: { 'Accept': 'application/json', 'x-api-key': getKey() }
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function searchStations(query: string): Promise<StationSearchResponse> {
  return apiGet(`/search/stations?query=${encodeURIComponent(query)}`);
}

export async function searchTrains(query: string): Promise<TrainSearchResponse> {
  return apiGet(`/search/trains?query=${encodeURIComponent(query)}`);
}

export async function getTrainSchedule(trainNumber: string, date: string): Promise<TrainScheduleResponse> {
  return apiGet(`/trains/${encodeURIComponent(trainNumber)}/schedule?journeyDate=${encodeURIComponent(date)}`);
}

export async function getLiveMap(trainType: string = 'ALL'): Promise<LiveMapResponse> {
  return apiGet(`/trains/live-map?trainType=${encodeURIComponent(trainType)}`);
}

export async function getAverageDelay(trainNumber: string): Promise<AverageDelayResponse> {
  return apiGet(`/trains/${encodeURIComponent(trainNumber)}/average-delay`);
}

export async function getStationLive(stationCode: string): Promise<StationLiveResponse> {
  return apiGet(`/stations/${encodeURIComponent(stationCode)}/live`);
}


