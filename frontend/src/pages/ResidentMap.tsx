import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polygon, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import api from '../services/api';
import { Spinner, Divider } from '@fluentui/react-components';
import {
  Map20Regular, People20Regular, Home20Regular,
  Search20Regular, Filter20Regular
} from '@fluentui/react-icons';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DA_NANG_CENTER: [number, number] = [16.047079, 108.206230];
const DA_NANG_ZOOM = 13;

const BASEMAPS: Record<string, { url: string; attribution: string }> = {
  normal: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  standard: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  standard_light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  standard_dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  standard_satellite: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  },
  outdoors: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  google: {
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  },
  google_satellite: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google'
  }
};


// Convex hull
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
function expandPolygon(hull: [number, number][], factor = 0.1): [number, number][] {
  if (hull.length < 3) return hull;
  const cLat = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cLng = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  return hull.map(([lat, lng]) => [cLat + (lat - cLat) * (1 + factor), cLng + (lng - cLng) * (1 + factor)]);
}

function parseGeoJSONBoundary(geojsonStr?: string): [number, number][][] | null {
  if (!geojsonStr) return null;
  try {
    const geojson = JSON.parse(geojsonStr);
    if (!geojson || !geojson.type) return null;
    
    if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
      const rawCoords = geojson.coordinates[0];
      const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
      if (
        leafletCoords.length > 1 &&
        leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] &&
        leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]
      ) {
        leafletCoords.pop();
      }
      return [leafletCoords];
    } else if (geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
      return geojson.coordinates.map((polyCoords: any) => {
        const rawCoords = polyCoords[0];
        const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
        if (
          leafletCoords.length > 1 &&
          leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] &&
          leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]
        ) {
          leafletCoords.pop();
        }
        return leafletCoords;
      });
    }
  } catch (e) {
    console.warn('Failed to parse GeoJSON boundary', e);
  }
  return null;
}

// Calculate area in square kilometers from array of polygons (or single polygon)
function calculatePolygonArea(polygonData: any): number {
  if (!polygonData || polygonData.length === 0) return 0;
  
  let polygons: [number, number][][] = [];
  if (Array.isArray(polygonData[0]) && typeof polygonData[0][0] === 'number') {
    polygons = [polygonData as [number, number][]];
  } else {
    polygons = polygonData as [number, number][][];
  }

  let totalArea = 0;
  const kEarthRadius = 6378137;

  for (const path of polygons) {
    if (path.length < 3) continue;
    let area = 0;
    const coords = [...path];
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0]);
    }
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      area += (p2[1] - p1[1]) * Math.PI / 180 * 
              (2 + Math.sin(p1[0] * Math.PI / 180) + Math.sin(p2[0] * Math.PI / 180));
    }
    totalArea += Math.abs(area * kEarthRadius * kEarthRadius / 2.0);
  }
  
  return totalArea / 1000000;
}

// Fit bounds
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => { if (bounds) map.fitBounds(bounds, { padding: [40, 40], duration: 1.2 }); }, [bounds, map]);
  return null;
}
function FlyToLocation({ position, zoom }: { position: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, zoom, { duration: 1.2 }); }, [position, zoom, map]);
  return null;
}

// Native Leaflet cluster layer for residents (bypasses React for performance)
function ResidentClusterLayer({ residents, householdCoordMap }: {
  residents: any[];
  householdCoordMap: Record<string, { lat: number; lng: number; head_name: string; address: string }>;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    if (residents.length === 0) return;

    // Create native Leaflet MarkerClusterGroup
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 19,
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount();
        let bg = '#818cf8';
        if (count > 500) bg = '#7c3aed';
        else if (count > 100) bg = '#6366f1';
        return L.divIcon({
          className: '',
          html: `<div style="background:${bg};width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;border:3px solid rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(99,102,241,0.4);">${count}</div>`,
          iconSize: [40, 40], iconAnchor: [20, 20],
        });
      }
    });

    // Add markers in batches for performance
    const markers: L.Marker[] = [];
    for (const r of residents) {
      const coord = householdCoordMap[r.household];
      if (!coord || typeof coord.lat !== 'number' || typeof coord.lng !== 'number') continue;
      const jLat = coord.lat + (Math.random() - 0.5) * 0.0003;
      const jLng = coord.lng + (Math.random() - 0.5) * 0.0003;
      const icon = L.divIcon({
        className: '',
        html: '<div style="background:#6366f1;width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const marker = L.marker([jLat, jLng], { icon });
      marker.bindPopup(`
        <div style="min-width:200px">
          <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;margin:-20px -20px 10px -20px">
            <strong>👤 Thông tin Cư dân</strong>
          </div>
          <div style="font-size:13px">
            <div style="margin-bottom:4px"><strong>Họ tên:</strong> ${r.full_name}</div>
            <div style="margin-bottom:4px"><strong>CCCD:</strong> ${r.cccd}</div>
            <div style="margin-bottom:4px"><strong>Tuổi:</strong> ${r.age} | <strong>GT:</strong> ${r.gender}</div>
            <div style="margin-bottom:4px"><strong>Cư trú:</strong> ${r.residency_status}</div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:6px 0"/>
            <div style="color:#6b7280;font-size:12px">🏠 Hộ: ${coord.head_name}<br/>📍 ${coord.address}</div>
          </div>
        </div>
      `, { minWidth: 220 });
      markers.push(marker);
    }

    cluster.addLayers(markers);
    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map, residents, householdCoordMap]);

  return null;
}

// Native Leaflet Heatmap Layer
function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (points.length === 0) return;
    
    layerRef.current = (L as any).heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 15,
      gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' }
    }).addTo(map);

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points]);

  return null;
}

// Native Leaflet cluster layer for households (bypasses React for performance & reliability)
function HouseholdClusterLayer({
  households,
  householdMembers,
  setHouseholdMembers,
  neighborhoodNamesMap
}: {
  households: any[];
  householdMembers: Record<string, any[]>;
  setHouseholdMembers: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  neighborhoodNamesMap: Record<string, string>;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);
  const membersRef = useRef(householdMembers);

  useEffect(() => {
    membersRef.current = householdMembers;
  }, [householdMembers]);

  useEffect(() => {
    if (!map) return;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    if (households.length === 0) return;

    // Create native Leaflet MarkerClusterGroup
    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 10,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: true,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 18,
    });

    const renderLeafletMembersTable = (container: HTMLDivElement, hhName: string, headName: string, loadedMembers?: any[]) => {
      const members = loadedMembers || membersRef.current[hhName] || [];
      const loadingEl = container.querySelector('.members-loading');
      if (!loadingEl) return;

      const tableHtml = `
        <table style="width: 100%; font-size: 12px; margin-top: 8px; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 5px 6px; text-align: left; border-bottom: 1px solid #e5e7eb;">Họ tên</th>
              <th style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #e5e7eb;">Tuổi</th>
              <th style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #e5e7eb;">GT</th>
              <th style="padding: 5px 6px; text-align: left; border-bottom: 1px solid #e5e7eb;">An sinh</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((m, j) => `
              <tr style="background: ${m.full_name === headName ? '#eff6ff' : (j % 2 ? '#f9fafb' : '#fff')}">
                <td style="padding: 5px 6px; border-bottom: 1px solid #f3f4f6;">
                  ${m.full_name === headName ? '<span title="Chủ hộ">⭐ </span>' : ''}${m.full_name}
                </td>
                <td style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #f3f4f6;">${m.age}</td>
                <td style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #f3f4f6;">${m.gender}</td>
                <td style="padding: 5px 6px; border-bottom: 1px solid #f3f4f6; font-size: 11px; color: ${m.social_welfare_status !== 'Bình thường' ? '#dc2626' : '#6b7280'};">
                  ${m.social_welfare_status !== 'Bình thường' ? m.social_welfare_status : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      loadingEl.outerHTML = tableHtml;
    };

    const markers: L.Marker[] = [];
    for (const h of households) {
      if (!h.latitude || !h.longitude) continue;

      const isSpecial = h.household_type && h.household_type !== 'Bình thường';
      const markerHtml = `<div style="background:${isSpecial ? '#ef4444' : '#3b82f6'};width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`;
      const customIcon = L.divIcon({ className: '', html: markerHtml, iconSize: [20, 20], iconAnchor: [10, 10] });

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '260px';
      popupContent.innerHTML = `
        <div style="background: linear-gradient(135deg, ${isSpecial ? '#ef4444,#b91c1c' : '#2563eb,#1d4ed8'}); color: #fff; padding: 10px 14px; border-radius: 8px 8px 0 0; margin: -20px -20px 12px -20px;">
          <strong style="font-size: 14px; color: #fff;">🏠 Hộ gia đình ${isSpecial ? `(${h.household_type})` : ''}</strong>
        </div>
        <div style="margin-bottom: 6px; font-size: 13px;">
          <span style="color: #6b7280; font-size: 12px;">Chủ hộ:</span>
          <span style="color: ${isSpecial ? '#ef4444' : '#2563eb'}; font-weight: 700;">${h.head_name}</span>
        </div>
        <div style="margin-bottom: 6px; font-size: 12px;">
          <span style="color: #6b7280;">Tổ dân phố:</span>
          <span style="font-weight: 600; color: #374151;">${neighborhoodNamesMap[h.neighborhood] || h.neighborhood}</span>
        </div>
        <div style="color: #6b7280; font-size: 12px; margin-bottom: 10px;">📍 ${h.address}</div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;" />
        <strong style="font-size: 13px;">👨‍👩‍👧‍👦 Thành viên:</strong>
        <div class="members-loading" style="text-align: center; padding: 10px; color: #9ca3af; font-size: 12px;">Đang tải...</div>
      `;

      const marker = L.marker([h.latitude, h.longitude], { icon: customIcon });
      marker.bindPopup(popupContent, { minWidth: 280, maxWidth: 360 });

      marker.on('popupopen', () => {
        if (membersRef.current[h.name]) {
          renderLeafletMembersTable(popupContent, h.name, h.head_name);
        } else {
          api.get('/api/method/frappe.client.get_list', {
            params: {
              doctype: 'Resident',
              filters: `[["household","=","${h.name}"]]`,
              fields: '["name","full_name","cccd","gender","age","residency_status","social_welfare_status"]',
              limit_page_length: 0
            }
          }).then(res => {
            const members = res.data.message || [];
            setHouseholdMembers(prev => ({ ...prev, [h.name]: members }));
            renderLeafletMembersTable(popupContent, h.name, h.head_name, members);
          });
        }
      });

      markers.push(marker);
    }

    cluster.addLayers(markers);
    map.addLayer(cluster);
    clusterRef.current = cluster;

    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map, households, neighborhoodNamesMap, setHouseholdMembers]);

  return null;
}

interface HouseholdData { name: string; head_name: string; address: string; latitude: number; longitude: number; neighborhood: string; household_type?: string; }
interface ResidentData { name: string; full_name: string; cccd: string; gender: string; age: number; residency_status: string; household: string; social_welfare_status?: string; household_type?: string; }
interface WardData { name: string; ward_name: string; district: string; administrative_code: string; area: number; population: number; density: number; headquarters: string; merged_with: string; geojson_boundary?: string; }
interface DistrictData { name: string; district_name: string; administrative_code: string; area: number; population: number; density: number; geojson_boundary?: string; }

export default function ResidentMap() {
  const location = useLocation();
  const [households, setHouseholds] = useState<HouseholdData[]>([]);
  const [allResidents, setAllResidents] = useState<ResidentData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedDistrictData, setSelectedDistrictData] = useState<DistrictData | null>(null);
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedWardData, setSelectedWardData] = useState<WardData | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [displayMode, setDisplayMode] = useState<'household' | 'resident' | 'heatmap'>('household');
  const [welfareFilter, setWelfareFilter] = useState<string>('');
  const [mapType, setMapType] = useState<string>('normal');
  const [householdMountKey, setHouseholdMountKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [householdMembers, setHouseholdMembers] = useState<Record<string, ResidentData[]>>({});
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [flyZoom, setFlyZoom] = useState(DA_NANG_ZOOM);
  const [fitBounds, setFitBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [wardNeighborhoods, setWardNeighborhoods] = useState<Record<string, string[]>>({});
  const [allNeighborhoods, setAllNeighborhoods] = useState<{ name: string; neighborhood_name: string; ward: string; geojson_polygon?: string }[]>([]);
  const [neighborhoodNamesMap, setNeighborhoodNamesMap] = useState<Record<string, string>>({});
  const mapboxContainerRef = useRef<HTMLDivElement>(null);
  const mapboxMapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxMarkersRef = useRef<mapboxgl.Marker[]>([]);

  // Fetch districts
  useEffect(() => {
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'District', fields: '["name","district_name","administrative_code","area","population","density","geojson_boundary"]', limit_page_length: 0 }
    }).then(res => {
      const data = res.data.message || [];
      setDistricts(data);
    });
  }, []);

  // Fetch all neighborhoods on mount for ID->Name mapping
  useEffect(() => {
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Neighborhood', fields: '["name","neighborhood_name","ward","geojson_polygon"]', limit_page_length: 0 }
    }).then(res => {
      const list = res.data.message || [];
      setAllNeighborhoods(list);
      const nameMap: Record<string, string> = {};
      list.forEach((n: any) => {
        nameMap[n.name] = n.neighborhood_name;
      });
      setNeighborhoodNamesMap(nameMap);
    });
  }, []);

  // Fetch wards
  useEffect(() => {
    const filters = selectedDistrict ? `[["district","=","${selectedDistrict}"]]` : '';
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Ward', fields: '["name","ward_name","district","administrative_code","area","population","density","headquarters","merged_with","geojson_boundary"]', filters, limit_page_length: 0 }
    }).then(res => setWards(res.data.message || []));
  }, [selectedDistrict]);

  // Fetch households
  useEffect(() => {
    setLoading(true);
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Household', fields: '["name","head_name","address","latitude","longitude","neighborhood","household_type"]', filters: '[["status","=","Đã định vị"]]', limit_page_length: 0 }
    }).then(res => { setHouseholds(res.data.message || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  // Handle URL param for auto-zoom to household
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetHhId = params.get('household');
    if (targetHhId && households.length > 0) {
      const hh = households.find(h => h.name === targetHhId);
      if (hh && hh.latitude && hh.longitude) {
        setFlyTarget([hh.latitude, hh.longitude]);
        setFlyZoom(19);
      }
    }
  }, [location.search, households]);

  // Fetch residents on mount
  useEffect(() => {
    if (allResidents.length === 0) {
      setLoadingResidents(true);
      api.get('/api/method/frappe.client.get_list', {
        params: { doctype: 'Resident', fields: '["name","full_name","cccd","gender","age","residency_status","household","social_welfare_status"]', limit_page_length: 0 }
      }).then(res => {
        setAllResidents(res.data.message || []);
      }).finally(() => setLoadingResidents(false));
    }
  }, [allResidents.length]);

  // Ward→neighborhood mapping
  useEffect(() => {
    if (!selectedDistrict && !selectedWard) { setWardNeighborhoods({}); return; }
    
    let filtered = allNeighborhoods;
    if (selectedWard) {
      filtered = allNeighborhoods.filter(n => n.ward === selectedWard);
    } else if (selectedDistrict) {
      const wardIds = wards.map(w => w.name);
      filtered = allNeighborhoods.filter(n => wardIds.includes(n.ward));
    }

    const m: Record<string, string[]> = {};
    filtered.forEach(n => {
      if (!m[n.ward]) m[n.ward] = [];
      m[n.ward].push(n.name);
    });
    setWardNeighborhoods(m);
  }, [selectedDistrict, selectedWard, wards, allNeighborhoods]);

  // Filtered households
  const filteredHouseholds = useMemo(() => {
    let list = households;
    if (selectedNeighborhood) {
      list = households.filter(h => h.neighborhood === selectedNeighborhood);
    } else if (selectedDistrict || selectedWard) {
      const allNB = new Set<string>();
      Object.values(wardNeighborhoods).forEach(ns => ns.forEach(n => allNB.add(n)));
      list = allNB.size === 0 ? [] : households.filter(h => allNB.has(h.neighborhood));
    }
    
    if (welfareFilter) {
      if (welfareFilter === 'Hộ nghèo' || welfareFilter === 'Hộ cận nghèo' || welfareFilter === 'Gia đình chính sách') {
        list = list.filter(h => h.household_type === welfareFilter);
      } else {
        // filter by resident welfare status
        const validHouseholdNames = new Set(allResidents.filter(r => r.social_welfare_status === welfareFilter).map(r => r.household));
        list = list.filter(h => validHouseholdNames.has(h.name));
      }
    }
    return list;
  }, [households, wardNeighborhoods, selectedDistrict, selectedWard, selectedNeighborhood, welfareFilter, allResidents]);

  const displayHouseholds = filteredHouseholds;

  // Coord map for resident mode
  const householdCoordMap = useMemo(() => {
    const m: Record<string, { lat: number; lng: number; head_name: string; address: string }> = {};
    displayHouseholds.forEach(h => { m[h.name] = { lat: h.latitude, lng: h.longitude, head_name: h.head_name, address: h.address }; });
    return m;
  }, [displayHouseholds]);

  // Active residents matching selected filters
  const activeResidents = useMemo(() => {
    return allResidents.filter(r => householdCoordMap[r.household]);
  }, [allResidents, householdCoordMap]);

  // Residents to display
  const displayResidents = useMemo(() => {
    if (displayMode !== 'resident') return [];
    return activeResidents;
  }, [displayMode, activeResidents]);

  // Neighborhood polygons
  const neighborhoodPolygons = useMemo(() => {
    if (!selectedWard) return [];
    const nbs = wardNeighborhoods[selectedWard] || [];
    return nbs.map(nb => {
      // Try to load from database geojson_polygon first
      const nbData = allNeighborhoods.find(n => n.name === nb);
      if (nbData && nbData.geojson_polygon) {
        try {
          const geojson = JSON.parse(nbData.geojson_polygon);
          if (geojson && geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
            const rawCoords = geojson.coordinates[0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            if (
              leafletCoords.length > 1 &&
              leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] &&
              leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]
            ) {
              leafletCoords.pop();
            }
            return { neighborhood: nb, polygon: leafletCoords };
          }
        } catch (e) {
          console.warn('Failed to parse database polygon for Neighborhood ' + nb, e);
        }
      }
      return null;
    }).filter(Boolean) as { neighborhood: string; polygon: [number, number][] }[];
  }, [wardNeighborhoods, selectedWard, allNeighborhoods]);

  // Boundary polygon
  const boundaryPolygon = useMemo(() => {
    if (selectedNeighborhood) {
      const foundPoly = neighborhoodPolygons.find(np => np.neighborhood === selectedNeighborhood);
      return foundPoly ? foundPoly.polygon : null;
    }
    if (selectedWard && selectedWardData) {
      const parsed = parseGeoJSONBoundary(selectedWardData.geojson_boundary);
      if (parsed) return parsed;
    }
    if (selectedDistrict && selectedDistrictData) {
      const parsed = parseGeoJSONBoundary(selectedDistrictData.geojson_boundary);
      if (parsed) return parsed;
    }
    if (displayHouseholds.length < 3 || (!selectedDistrict && !selectedWard)) return null;
    let targetHouseholds = displayHouseholds;
    if (targetHouseholds.length < 3) return null;
    return expandPolygon(convexHull(targetHouseholds.map(h => [h.latitude, h.longitude] as [number, number])), 0.08);
  }, [displayHouseholds, selectedDistrict, selectedDistrictData, selectedWard, selectedWardData, selectedNeighborhood, neighborhoodPolygons]);

  // Per-ward polygons
  const wardPolygons = useMemo(() => {
    if (!selectedDistrict || selectedWard) return [];
    return wards.map(w => {
      const parsed = parseGeoJSONBoundary(w.geojson_boundary);
      if (parsed) {
        return { ward: w, polygon: parsed };
      }
      const nbs = wardNeighborhoods[w.name] || [];
      const wHH = households.filter(h => nbs.includes(h.neighborhood));
      if (wHH.length < 3) return null;
      return { ward: w, polygon: expandPolygon(convexHull(wHH.map(h => [h.latitude, h.longitude] as [number, number])), 0.05) };
    }).filter(Boolean) as { ward: WardData; polygon: any }[];
  }, [wards, wardNeighborhoods, households, selectedDistrict, selectedWard]);

  // District polygons
  const districtPolygons = useMemo(() => {
    if (selectedDistrict) return [];
    return districts.map(d => {
      const parsed = parseGeoJSONBoundary(d.geojson_boundary);
      if (parsed) {
        return { district: d, polygon: parsed };
      }
      const dWards = wards.filter(w => w.district === d.name);
      const dNbs = dWards.flatMap(w => wardNeighborhoods[w.name] || []);
      const dHH = households.filter(h => dNbs.includes(h.neighborhood));
      if (dHH.length < 3) return null;
      return { district: d, polygon: expandPolygon(convexHull(dHH.map(h => [h.latitude, h.longitude] as [number, number])), 0.08) };
    }).filter(Boolean) as { district: DistrictData; polygon: any }[];
  }, [districts, wards, wardNeighborhoods, households, selectedDistrict]);

  // Auto fit bounds
  useEffect(() => {
    if (boundaryPolygon && boundaryPolygon.length > 0) {
      const isMulti = Array.isArray(boundaryPolygon[0][0]);
      let flatPoints: [number, number][] = [];
      if (isMulti) {
        (boundaryPolygon as [number, number][][]).forEach(poly => {
          flatPoints.push(...poly);
        });
      } else {
        flatPoints = boundaryPolygon as [number, number][];
      }
      setFitBounds(L.latLngBounds(flatPoints.map(p => L.latLng(p[0], p[1]))));
      setFlyTarget(null);
    } else if (selectedNeighborhood) {
      const targetHouseholds = households.filter(h => h.neighborhood === selectedNeighborhood);
      if (targetHouseholds.length > 0) {
        const avgLat = targetHouseholds.reduce((acc, h) => acc + h.latitude, 0) / targetHouseholds.length;
        const avgLng = targetHouseholds.reduce((acc, h) => acc + h.longitude, 0) / targetHouseholds.length;
        setFlyTarget([avgLat, avgLng]);
        setFlyZoom(16);
        setFitBounds(null);
      }
    } else if (!selectedDistrict && !selectedWard) {
      setFlyTarget(DA_NANG_CENTER); setFlyZoom(DA_NANG_ZOOM); setFitBounds(null);
    }
  }, [boundaryPolygon, selectedDistrict, selectedWard, selectedNeighborhood, households]);

  // Fetch household members
  const fetchHouseholdMembers = useCallback((hhName: string) => {
    if (householdMembers[hhName]) return;
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Resident', filters: `[["household","=","${hhName}"]]`, fields: '["name","full_name","cccd","gender","age","residency_status"]', limit_page_length: 0 }
    }).then(res => { setHouseholdMembers(prev => ({ ...prev, [hhName]: res.data.message || [] })); });
  }, [householdMembers]);

  // Initialize Mapbox Map
  useEffect(() => {
    if (mapType !== 'dt' || !mapboxContainerRef.current) {
      if (mapboxMapRef.current) {
        mapboxMapRef.current.remove();
        mapboxMapRef.current = null;
      }
      return;
    }

    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZHRodWJjbG91ZCIsImEiOiJjbHdkYzJybm8wMTB4MmlwOTV1MmxwY29oIn0.aFk1dmc2SWpDOUdfTUl1N2c';

    const OSM_FALLBACK_STYLE: any = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: [
            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
            'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    };

    let map: mapboxgl.Map;

    // Check style availability
    const styleUrl = 'https://map.sontra.dthub.cloud/styles/osm-bright/style.json';
    fetch(styleUrl, { method: 'HEAD' })
      .then((res) => {
        initMap(res.ok ? styleUrl : OSM_FALLBACK_STYLE);
      })
      .catch(() => {
        initMap(OSM_FALLBACK_STYLE);
      });

    function initMap(styleToUse: any) {
      if (!mapboxContainerRef.current) return;
      try {
        map = new mapboxgl.Map({
          container: mapboxContainerRef.current,
          style: styleToUse,
          center: [DA_NANG_CENTER[1], DA_NANG_CENTER[0]],
          zoom: DA_NANG_ZOOM,
          pitch: 60,
          bearing: -17.6,
        });

        mapboxMapRef.current = map;

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.addControl(new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true
        }), 'top-right');

        map.on('error', (e) => {
          console.warn('Mapbox GL error:', e.error);
          if (map && (map.getStyle() === undefined || (e.error && e.error.message && e.error.message.includes('style')))) {
            try {
              map.setStyle(OSM_FALLBACK_STYLE);
            } catch (err) {
              console.error('Fallback style application failed:', err);
            }
          }
        });

        map.on('style.load', () => {
          // Add 3D terrain if vector style is loaded
          try {
            if (!map.getSource('mapbox-dem') && styleToUse === styleUrl) {
              map.addSource('mapbox-dem', {
                type: 'raster-dem',
                url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
                tileSize: 512,
                maxzoom: 14
              });
              map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
            }
          } catch (e) {
            console.warn('Terrain load skipped:', e);
          }

          // Add 3D building extrusion
          try {
            if (map.getSource('composite')) {
              const layers = map.getStyle().layers;
              const labelLayerId = layers.find(
                (layer) => layer.type === 'symbol' && layer.layout && layer.layout['text-field']
              )?.id;

              if (!map.getLayer('3d-buildings')) {
                map.addLayer(
                  {
                    id: '3d-buildings',
                    source: 'composite',
                    'source-layer': 'building',
                    filter: ['==', 'extrude', 'true'],
                    type: 'fill-extrusion',
                    minzoom: 15,
                    paint: {
                      'fill-extrusion-color': '#aaa',
                      'fill-extrusion-height': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'height']
                      ],
                      'fill-extrusion-base': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        15,
                        0,
                        15.05,
                        ['get', 'min_height']
                      ],
                      'fill-extrusion-opacity': 0.6
                    }
                  },
                  labelLayerId
                );
              }

              // Adjust label alignment
              layers.forEach((layer) => {
                if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
                  map.setLayoutProperty(layer.id, 'text-pitch-alignment', 'map');
                  map.setLayoutProperty(layer.id, 'text-rotation-alignment', 'map');
                }
              });
            }
          } catch (e) {
            console.warn('3D Buildings layer skipped:', e);
          }
        });
      } catch (err) {
        console.error('Mapbox initialization error:', err);
      }
    }

    return () => {
      if (mapboxMapRef.current) {
        mapboxMapRef.current.remove();
        mapboxMapRef.current = null;
      }
    };
  }, [mapType]);

  // Sync Mapbox Layers and Markers
  useEffect(() => {
    const map = mapboxMapRef.current;
    if (!map || mapType !== 'dt') return;

    // Clear existing markers
    mapboxMarkersRef.current.forEach(marker => marker.remove());
    mapboxMarkersRef.current = [];

    const onMapReady = () => {
      // Remove existing custom sources and layers
      if (map.getLayer('household-heat')) map.removeLayer('household-heat');
      if (map.getSource('household-heat-source')) map.removeSource('household-heat-source');
      if (map.getLayer('boundary-poly')) map.removeLayer('boundary-poly');
      if (map.getLayer('boundary-line')) map.removeLayer('boundary-line');
      if (map.getSource('boundary-source')) map.removeSource('boundary-source');

      // 1. Boundary Polygon
      if (boundaryPolygon && boundaryPolygon.length > 0) {
        const isMulti = Array.isArray(boundaryPolygon[0][0]);
        let geojsonGeometry: any;
        let boundsPoints: [number, number][] = [];

        if (isMulti) {
          const multiCoords = (boundaryPolygon as [number, number][][]).map(poly => {
            const coords = [...poly, poly[0]].map(p => [p[1], p[0]] as [number, number]);
            boundsPoints.push(...coords);
            return [coords];
          });
          geojsonGeometry = {
            type: 'MultiPolygon',
            coordinates: multiCoords
          };
        } else {
          const poly = boundaryPolygon as [number, number][];
          const coords = [...poly, poly[0]].map(p => [p[1], p[0]] as [number, number]);
          boundsPoints = coords;
          geojsonGeometry = {
            type: 'Polygon',
            coordinates: [coords]
          };
        }

        map.addSource('boundary-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: geojsonGeometry,
            properties: {}
          }
        });
        map.addLayer({
          id: 'boundary-poly',
          type: 'fill',
          source: 'boundary-source',
          paint: {
            'fill-color': '#dc2626',
            'fill-opacity': 0.08
          }
        });
        map.addLayer({
          id: 'boundary-line',
          type: 'line',
          source: 'boundary-source',
          paint: {
            'line-color': '#dc2626',
            'line-width': 3,
            'line-dasharray': [2, 1]
          }
        });

        const bounds = new mapboxgl.LngLatBounds();
        boundsPoints.forEach(c => bounds.extend(c));
        map.fitBounds(bounds, { padding: 40, duration: 1200 });
      } else if (flyTarget) {
        map.flyTo({ center: [flyTarget[1], flyTarget[0]], zoom: flyZoom, duration: 1200 });
      }

      // 2. Heatmap Mode
      if (displayMode === 'heatmap') {
        const features = displayHouseholds.map(h => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [h.longitude, h.latitude]
          },
          properties: { dbh: 1 }
        }));

        map.addSource('household-heat-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: features as any
          }
        });

        map.addLayer({
          id: 'household-heat',
          type: 'heatmap',
          source: 'household-heat-source',
          maxzoom: 15,
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'dbh'], 0, 0, 6, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,255,0)',
              0.4, 'blue',
              0.6, 'lime',
              0.8, 'yellow',
              1.0, 'red'
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 15, 25],
            'heatmap-opacity': 0.8
          }
        });
      }

      // 3. Household Mode
      if (displayMode === 'household') {
        displayHouseholds.forEach(h => {
          if (!h.latitude || !h.longitude) return;

          const isSpecial = h.household_type && h.household_type !== 'Bình thường';
          const el = document.createElement('div');
          el.style.background = isSpecial ? '#ef4444' : '#3b82f6';
          el.style.width = '16px';
          el.style.height = '16px';
          el.style.borderRadius = '50%';
          el.style.border = '2px solid #fff';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
          el.style.cursor = 'pointer';

          const popupContainer = document.createElement('div');
          popupContainer.style.minWidth = '260px';
          popupContainer.innerHTML = `
            <div style="background: linear-gradient(135deg, ${isSpecial ? '#ef4444,#b91c1c' : '#2563eb,#1d4ed8'}); color: #fff; padding: 10px 14px; border-radius: 8px 8px 0 0; margin: -10px -10px 12px -10px;">
              <strong style="font-size: 14px; color: #fff;">🏠 Hộ gia đình ${isSpecial ? `(${h.household_type})` : ''}</strong>
            </div>
            <div style="margin-bottom: 6px; font-size: 13px;">
              <span style="color: #6b7280; font-size: 12px;">Chủ hộ:</span>
              <span style="color: ${isSpecial ? '#ef4444' : '#2563eb'}; font-weight: 700;">${h.head_name}</span>
            </div>
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 10px;">📍 ${h.address}</div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;" />
            <strong style="font-size: 13px;">👨‍👩‍👧‍👦 Thành viên:</strong>
            <div class="members-loading" style="text-align: center; padding: 10px; color: #9ca3af; font-size: 12px;">Đang tải...</div>
          `;

          const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '360px' })
            .setDOMContent(popupContainer);

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([h.longitude, h.latitude])
            .setPopup(popup)
            .addTo(map);

          mapboxMarkersRef.current.push(marker);

          popup.on('open', () => {
            if (householdMembers[h.name]) {
              renderMembersTable(popupContainer, h.name, h.head_name);
            } else {
              api.get('/api/method/frappe.client.get_list', {
                params: {
                  doctype: 'Resident',
                  filters: `[["household","=","${h.name}"]]`,
                  fields: '["name","full_name","cccd","gender","age","residency_status","social_welfare_status"]',
                  limit_page_length: 0
                }
              }).then(res => {
                const members = res.data.message || [];
                setHouseholdMembers(prev => ({ ...prev, [h.name]: members }));
                renderMembersTable(popupContainer, h.name, h.head_name, members);
              });
            }
          });
        });
      }

      // 4. Resident Mode
      if (displayMode === 'resident' && !loadingResidents) {
        const activeResidents = welfareFilter 
          ? displayResidents.filter(r => r.social_welfare_status === welfareFilter || r.household_type === welfareFilter)
          : displayResidents;

        activeResidents.forEach(r => {
          const coord = householdCoordMap[r.household];
          if (!coord) return;

          const jLat = coord.lat + (Math.random() - 0.5) * 0.0003;
          const jLng = coord.lng + (Math.random() - 0.5) * 0.0003;

          const el = document.createElement('div');
          el.style.background = '#6366f1';
          el.style.width = '10px';
          el.style.height = '10px';
          el.style.borderRadius = '50%';
          el.style.border = '2px solid #fff';
          el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';
          el.style.cursor = 'pointer';

          const popup = new mapboxgl.Popup({ offset: 10, maxWidth: '280px' })
            .setHTML(`
              <div style="min-width:200px">
                <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;margin:-10px -10px 10px -10px">
                  <strong>👤 Thông tin Cư dân</strong>
                </div>
                <div style="font-size:13px">
                  <div style="margin-bottom:4px"><strong>Họ tên:</strong> ${r.full_name}</div>
                  <div style="margin-bottom:4px"><strong>CCCD:</strong> ${r.cccd}</div>
                  <div style="margin-bottom:4px"><strong>Tuổi:</strong> ${r.age} | <strong>GT:</strong> ${r.gender}</div>
                  <div style="margin-bottom:4px"><strong>Cư trú:</strong> ${r.residency_status}</div>
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:6px 0"/>
                  <div style="color:#6b7280;font-size:12px">🏠 Hộ: ${coord.head_name}<br/>📍 ${coord.address}</div>
                </div>
              </div>
            `);

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([jLng, jLat])
            .setPopup(popup)
            .addTo(map);

          mapboxMarkersRef.current.push(marker);
        });
      }
    };

    const renderMembersTable = (container: HTMLDivElement, hhName: string, headName: string, loadedMembers?: any[]) => {
      const members = loadedMembers || householdMembers[hhName] || [];
      const loadingEl = container.querySelector('.members-loading');
      if (!loadingEl) return;

      const tableHtml = `
        <table style="width: 100%; font-size: 12px; margin-top: 8px; border-collapse: collapse;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 5px 6px; text-align: left; border-bottom: 1px solid #e5e7eb;">Họ tên</th>
              <th style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #e5e7eb;">Tuổi</th>
              <th style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #e5e7eb;">GT</th>
              <th style="padding: 5px 6px; text-align: left; border-bottom: 1px solid #e5e7eb;">An sinh</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((m, j) => `
              <tr style="background: ${m.full_name === headName ? '#eff6ff' : (j % 2 ? '#f9fafb' : '#fff')}">
                <td style="padding: 5px 6px; border-bottom: 1px solid #f3f4f6;">
                  ${m.full_name === headName ? '<span title="Chủ hộ">⭐ </span>' : ''}${m.full_name}
                </td>
                <td style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #f3f4f6;">${m.age}</td>
                <td style="padding: 5px 6px; text-align: center; border-bottom: 1px solid #f3f4f6;">${m.gender}</td>
                <td style="padding: 5px 6px; border-bottom: 1px solid #f3f4f6; font-size: 11px; color: ${m.social_welfare_status !== 'Bình thường' ? '#dc2626' : '#6b7280'};">
                  ${m.social_welfare_status !== 'Bình thường' ? m.social_welfare_status : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      loadingEl.outerHTML = tableHtml;
    };

    if (map.isStyleLoaded()) {
      onMapReady();
    } else {
      map.once('style.load', onMapReady);
    }

  }, [mapType, displayMode, displayHouseholds, displayResidents, boundaryPolygon, flyTarget, flyZoom, loadingResidents, welfareFilter, householdMembers]);


  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .premium-select-container {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0 12px;
          height: 38px;
          transition: all 0.2s ease-in-out;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .premium-select-container:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .premium-select-container:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .premium-select {
          outline: none;
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 500;
          color: #334155;
          cursor: pointer;
          font-family: inherit;
          height: 100%;
          width: 100%;
        }
        .premium-toggle-btn {
          padding: 6px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s ease-in-out;
        }
        .premium-stat-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 6px 14px;
          border-radius: 20px;
          color: #475569;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
        }
      `}</style>

      {/* Toolbar */}
      <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', zIndex: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#2563eb', padding: 8, borderRadius: 10 }}>
            <Map20Regular />
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', fontFamily: '"Outfit", "Inter", sans-serif', letterSpacing: '-0.02em' }}>Bản đồ Cư dân</span>
        </div>

        <div className="premium-select-container">
          <select value={mapType} onChange={e => setMapType(e.target.value)} className="premium-select">
            <option value="normal">Map thường</option>
            <option value="satellite">Map vệ tinh</option>
            <option value="3d">Map 3D</option>
            <option value="dt">DT map</option>
            <option value="standard">Chuẩn (CartoDB Voyager)</option>
            <option value="standard_light">Sáng chuẩn (CartoDB Light)</option>
            <option value="standard_dark">Tối chuẩn (CartoDB Dark)</option>
            <option value="standard_satellite">Vệ tinh chuẩn (Google Hybrid)</option>
            <option value="outdoors">Ngoài trời (OpenTopoMap)</option>
            <option value="osm">OSM (OpenStreetMap)</option>
            <option value="google">Google Maps</option>
            <option value="google_satellite">Google Vệ tinh</option>
          </select>
        </div>

        <div className="premium-select-container">
          <Filter20Regular style={{ color: '#64748b' }} />
          <select value={selectedDistrict} onChange={e => { 
              const val = e.target.value;
              setSelectedDistrict(val); 
              setSelectedDistrictData(val ? districts.find(d => d.name === val) || null : null);
              setSelectedWard(''); 
              setSelectedWardData(null); 
              setSelectedNeighborhood('');
            }}
            className="premium-select">
            <option value="">Tất cả Quận/Huyện</option>
            {districts.map(d => <option key={d.name} value={d.name}>{d.district_name}</option>)}
          </select>
        </div>

        <div className="premium-select-container">
          <Search20Regular style={{ color: '#64748b' }} />
          <select value={selectedWard} onChange={e => { 
              const val = e.target.value;
              setSelectedWard(val); 
              setSelectedWardData(val ? wards.find(w => w.name === val) || null : null); 
              setSelectedNeighborhood('');
            }}
            className="premium-select">
            <option value="">Tìm Phường/Xã...</option>
            {wards.map(w => <option key={w.name} value={w.name}>{w.ward_name}</option>)}
          </select>
        </div>

        <div className="premium-select-container" style={{ opacity: !selectedWard ? 0.6 : 1, background: !selectedWard ? '#f8fafc' : '#ffffff' }}>
          <Home20Regular style={{ color: '#64748b' }} />
          <select value={selectedNeighborhood} onChange={e => setSelectedNeighborhood(e.target.value)}
            disabled={!selectedWard}
            className="premium-select">
            <option value="">Tất cả Tổ</option>
            {(wardNeighborhoods[selectedWard] || []).map(n => (
              <option key={n} value={n}>{neighborhoodNamesMap[n] || n}</option>
            ))}
          </select>
        </div>

        <div className="premium-select-container" style={{ 
          borderColor: welfareFilter ? '#fca5a5' : '#e2e8f0', 
          background: welfareFilter ? '#fef2f2' : '#ffffff' 
        }}>
          <select value={welfareFilter} onChange={e => setWelfareFilter(e.target.value)}
            className="premium-select"
            style={{ color: welfareFilter ? '#dc2626' : '#334155' }}>
            <option value="">Tất cả (An sinh)</option>
            <option value="Hộ nghèo">Hộ nghèo</option>
            <option value="Hộ cận nghèo">Hộ cận nghèo</option>
            <option value="Gia đình chính sách">Gia đình chính sách</option>
            <option value="Người cao tuổi neo đơn">Người cao tuổi neo đơn</option>
            <option value="Người khuyết tật">Người khuyết tật</option>
          </select>
        </div>

        {/* Display mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 3, border: '1px solid #e2e8f0' }}>
          <button onClick={() => { setDisplayMode('household'); setHouseholdMountKey(Date.now()); }} 
            className="premium-toggle-btn"
            style={{
              background: displayMode === 'household' ? '#2563eb' : 'transparent',
              color: displayMode === 'household' ? '#fff' : '#475569',
              boxShadow: displayMode === 'household' ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
            }}>
            <Home20Regular style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hộ gia đình
          </button>
          <button onClick={() => setDisplayMode('resident')} 
            className="premium-toggle-btn"
            style={{
              background: displayMode === 'resident' ? '#6366f1' : 'transparent',
              color: displayMode === 'resident' ? '#fff' : '#475569',
              boxShadow: displayMode === 'resident' ? '0 2px 4px rgba(99, 102, 241, 0.2)' : 'none',
            }}>
            <People20Regular style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cư dân
          </button>
          <button onClick={() => setDisplayMode('heatmap')} 
            className="premium-toggle-btn"
            style={{
              background: displayMode === 'heatmap' ? '#ef4444' : 'transparent',
              color: displayMode === 'heatmap' ? '#fff' : '#475569',
              boxShadow: displayMode === 'heatmap' ? '0 2px 4px rgba(239, 68, 68, 0.2)' : 'none',
            }}>
            🔥 Heatmap
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="premium-stat-badge">
            <Home20Regular style={{ color: '#64748b', width: 16, height: 16 }} />
            <span><strong>{displayHouseholds.length}</strong> hộ</span>
          </div>
          {!loadingResidents && (
            <div className="premium-stat-badge">
              <People20Regular style={{ color: '#64748b', width: 16, height: 16 }} />
              <span>
                <strong>
                  {welfareFilter ? (welfareFilter.includes('Người') ? activeResidents.filter(r => r.social_welfare_status === welfareFilter).length : displayHouseholds.length) : activeResidents.length}
                </strong> người
              </span>
            </div>
          )}
          {loadingResidents && (
            <div className="premium-stat-badge" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#b45309' }}>
              <Spinner size="tiny" />
              <span>Đang tải...</span>
            </div>
          )}
        </div>
      </div>

      {/* Info Panels */}
      {selectedDistrictData && !selectedWardData && (
        <div style={{ position: 'absolute', top: 60, left: 280, zIndex: 1000, background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', padding: 16, width: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#2563eb' }}>Quận {selectedDistrictData.district_name}</h3>
            <button onClick={() => { setSelectedDistrict(''); setSelectedDistrictData(null); setSelectedNeighborhood(''); }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>
          <Divider />
          <div style={{ marginTop: 12 }}>
            {(() => {
              const parsedGeo = parseGeoJSONBoundary(selectedDistrictData.geojson_boundary);
              const computedArea = parsedGeo ? calculatePolygonArea(parsedGeo) : (selectedDistrictData.area || 0);
              const computedPopulation = activeResidents.length;
              return [
                { icon: '🔖', label: 'Mã ĐVHC', value: selectedDistrictData.administrative_code },
                { icon: '📐', label: 'Diện tích', value: `${computedArea.toFixed(2)} km²` },
                { icon: '👥', label: 'Dân số', value: `${computedPopulation.toLocaleString()} người` },
                { icon: '🏢', label: 'Số Phường', value: `${wards.length} phường` },
                { icon: '🏘️', label: 'Số Tổ', value: `${Object.values(wardNeighborhoods).flat().length} tổ` },
                { icon: '🏠', label: 'Số Hộ Gia Đình', value: `${displayHouseholds.length} hộ` },
              ];
            })().map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{row.icon} {row.label}</span>
                <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right', maxWidth: 180 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedWardData && !selectedNeighborhood && (
        <div style={{ position: 'absolute', top: 60, left: 280, zIndex: 1000, background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', padding: 16, width: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1d4ed8' }}>Phường {selectedWardData.ward_name}</h3>
            <button onClick={() => { setSelectedWard(''); setSelectedWardData(null); setSelectedNeighborhood(''); }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>
          <Divider />
          <div style={{ marginTop: 12 }}>
            {(() => {
              const parsedGeo = parseGeoJSONBoundary(selectedWardData.geojson_boundary);
              const computedArea = parsedGeo ? calculatePolygonArea(parsedGeo) : (selectedWardData.area || 0);
              const computedPopulation = activeResidents.length;
              const computedDensity = computedArea > 0 ? (computedPopulation / computedArea) : 0;
              return [
                { icon: '🏛', label: 'Thuộc', value: 'Đà Nẵng' },
                { icon: '🔖', label: 'Mã ĐVHC', value: selectedWardData.administrative_code },
                { icon: '📐', label: 'Diện tích', value: `${computedArea.toFixed(2)} km²` },
                { icon: '👥', label: 'Dân số', value: `${computedPopulation.toLocaleString()} người` },
                { icon: '🏘️', label: 'Số Tổ', value: `${Object.values(wardNeighborhoods).flat().length} tổ` },
                { icon: '🏠', label: 'Số Hộ Gia Đình', value: `${displayHouseholds.length} hộ` },
                { icon: '🧮', label: 'Mật độ', value: `${computedDensity.toLocaleString(undefined, {maximumFractionDigits: 2})} ng/km²` },
              ];
            })().map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{row.icon} {row.label}</span>
                <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right', maxWidth: 180 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedNeighborhood && (
        <div style={{ position: 'absolute', top: 60, left: 280, zIndex: 1000, background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', padding: 16, width: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{neighborhoodNamesMap[selectedNeighborhood] || `Tổ ${selectedNeighborhood}`}</h3>
            <button onClick={() => setSelectedNeighborhood('')}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
          </div>
          <Divider />
          <div style={{ marginTop: 12 }}>
            {[
              { icon: '🏛', label: 'Phường', value: selectedWardData?.ward_name || '' },
              { icon: '🏙️', label: 'Quận', value: selectedDistrictData?.district_name || selectedDistrict || 'Đà Nẵng' },
              { icon: '🏠', label: 'Số Hộ Gia Đình', value: `${households.filter(h => h.neighborhood === selectedNeighborhood).length} hộ` },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{row.icon} {row.label}</span>
                <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right', maxWidth: 180 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', zIndex: 0 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Spinner label="Đang tải dữ liệu bản đồ..." />
          </div>
        ) : mapType === '3d' ? (
          <iframe 
            src={`https://osmbuildings.org/?lat=${DA_NANG_CENTER[0]}&lon=${DA_NANG_CENTER[1]}&zoom=${DA_NANG_ZOOM}&tilt=30`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="3D Map"
          />
        ) : mapType === 'dt' ? (
          <div ref={mapboxContainerRef} style={{ width: '100%', height: '100%' }} />
        ) : (
          <MapContainer center={DA_NANG_CENTER} zoom={DA_NANG_ZOOM} style={{ height: '100%', width: '100%' }}>
            {BASEMAPS[mapType] ? (
              <TileLayer 
                key={mapType}
                url={BASEMAPS[mapType].url} 
                attribution={BASEMAPS[mapType].attribution} 
              />
            ) : (
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
            )}
            <FlyToLocation position={flyTarget} zoom={flyZoom} />
            <FitBounds bounds={fitBounds} />

            {/* Boundary polygon */}
            {boundaryPolygon && (
              <Polygon positions={boundaryPolygon}
                pathOptions={{ color: '#dc2626', weight: 3, opacity: 0.8, fillColor: '#fecaca', fillOpacity: 0.08, dashArray: '8,4' }} />
            )}



            {/* Ward polygons */}
            {selectedDistrict && !selectedWard && wardPolygons.map((wp, i) => (
              <Polygon key={i} positions={wp.polygon}
                pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.7, fillColor: '#fef3c7', fillOpacity: 0.12 }}
                eventHandlers={{ click: () => { setSelectedWard(wp.ward.name); setSelectedWardData(wp.ward); } }}>
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95} sticky>
                  <div style={{ fontSize: 13 }}><strong>{wp.ward.ward_name}</strong><br/>👥 {wp.ward.population?.toLocaleString()} | 📐 {wp.ward.area} km²</div>
                </Tooltip>
              </Polygon>
            ))}

            {/* Neighborhood polygons (inside a selected Ward) */}
            {selectedWard && !selectedNeighborhood && neighborhoodPolygons.map((np, i) => (
              <Polygon key={i} positions={np.polygon}
                pathOptions={{ 
                  color: '#10b981', 
                  weight: 2, 
                  opacity: 0.8, 
                  fillColor: '#d1fae5', 
                  fillOpacity: 0.2,
                  dashArray: '4,4'
                }}
                eventHandlers={{ click: () => setSelectedNeighborhood(np.neighborhood) }}>
                <Tooltip direction="top" offset={[0, -10]} opacity={0.95} sticky>
                  <div style={{ fontSize: 13 }}>
                    <strong>{neighborhoodNamesMap[np.neighborhood] || `Tổ ${np.neighborhood}`}</strong><br/>
                    🏠 {households.filter(h => h.neighborhood === np.neighborhood).length} hộ gia đình
                  </div>
                </Tooltip>
              </Polygon>
            ))}

            {selectedNeighborhood && neighborhoodPolygons.find(np => np.neighborhood === selectedNeighborhood) && (
              <Polygon positions={neighborhoodPolygons.find(np => np.neighborhood === selectedNeighborhood)!.polygon}
                pathOptions={{ 
                  color: '#ef4444', 
                  weight: 3, 
                  opacity: 0.8, 
                  fillColor: '#fca5a5', 
                  fillOpacity: 0.2,
                  dashArray: '4,4'
                }}
              />
            )}

            {/* Household mode: React markers with clustering */}
            {displayMode === 'household' && (
              <HouseholdClusterLayer
                households={displayHouseholds}
                householdMembers={householdMembers}
                setHouseholdMembers={setHouseholdMembers}
                neighborhoodNamesMap={neighborhoodNamesMap}
              />
            )}

            {/* Resident mode */}
            {displayMode === 'resident' && !loadingResidents && (
              <ResidentClusterLayer residents={welfareFilter ? displayResidents.filter(r => r.social_welfare_status === welfareFilter || r.household_type === welfareFilter) : displayResidents} householdCoordMap={householdCoordMap} />
            )}

            {/* Heatmap mode */}
            {displayMode === 'heatmap' && (
              <HeatmapLayer points={displayHouseholds.filter(h => h.latitude && h.longitude).map(h => [h.latitude, h.longitude, 1])} />
            )}
          </MapContainer>
        )}

        {/* Loading overlay for resident mode */}
        {loadingResidents && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <Spinner label="Đang tải dữ liệu..." />
          </div>
        )}
      </div>
    </div>
  );
}
