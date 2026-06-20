import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, CircleMarker, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import {
  Button, Input, Title1, Dialog, DialogSurface, DialogTitle, DialogBody,
  DialogActions, DialogContent, Field, Select, Spinner
} from '@fluentui/react-components';
import {
  Map20Regular, Search20Regular, Add20Regular,
  Checkmark20Regular, Dismiss20Regular, ArrowUndo20Regular, Edit20Regular
} from '@fluentui/react-icons';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DA_NANG_CENTER: [number, number] = [16.047079, 108.206230];
const DA_NANG_ZOOM = 13;

interface DistrictData { name: string; district_name: string; }
interface WardData { name: string; ward_name: string; district: string; geojson_boundary?: string; }
interface NeighborhoodData { name: string; neighborhood_name: string; ward: string; leader_name?: string; geojson_polygon?: string; }

// Fit bounds helper
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50], duration: 1.0 });
    }
  }, [bounds, map]);
  return null;
}

// Map Click Handler for Drawing Mode
function MapClickEvents({ onMapClick, enabled }: { onMapClick: (latlng: L.LatLng) => void; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
}

export default function NeighborhoodList() {
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Item
  const [selectedNbName, setSelectedNbName] = useState<string | null>(null);

  // Drawing State
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);

  // Add Neighborhood State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNb, setNewNb] = useState({ neighborhood_name: '', ward: '', leader_name: '' });

  // Edit Neighborhood State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editNb, setEditNb] = useState({ name: '', neighborhood_name: '', ward: '', leader_name: '' });

  // Delete Neighborhood State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingNb, setDeletingNb] = useState<{name: string, neighborhood_name: string} | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [affectedHouseholds, setAffectedHouseholds] = useState<any[]>([]);
  const [deleteOption, setDeleteOption] = useState<'orphan' | 'reassign'>('orphan');
  const [reassignNb, setReassignNb] = useState('');

  // Load Wards & Districts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resDistricts, resWards] = await Promise.all([
          api.get('/api/method/frappe.client.get_list', {
            params: { doctype: 'District', fields: '["name","district_name"]', limit_page_length: 0 }
          }),
          api.get('/api/method/frappe.client.get_list', {
            params: { doctype: 'Ward', fields: '["name","ward_name","district","geojson_boundary"]', limit_page_length: 0 }
          })
        ]);
        setDistricts(resDistricts.data.message || []);
        setWards(resWards.data.message || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch Neighborhoods
  const fetchNeighborhoods = async () => {
    try {
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: {
          doctype: 'Neighborhood',
          fields: '["name","neighborhood_name","ward","leader_name","geojson_polygon"]',
          limit_page_length: 0
        }
      });
      setNeighborhoods(res.data.message || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNeighborhoods();
  }, []);

  // Filtered wards based on district selection
  const filteredWards = useMemo(() => {
    if (!selectedDistrict) return [];
    return wards.filter(w => w.district === selectedDistrict);
  }, [wards, selectedDistrict]);

  // Filtered Neighborhood List
  const filteredNeighborhoods = useMemo(() => {
    let list = neighborhoods;
    if (selectedWard) {
      list = list.filter(n => n.ward === selectedWard);
    } else if (selectedDistrict) {
      const dWards = new Set(filteredWards.map(w => w.name));
      list = list.filter(n => dWards.has(n.ward));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        n =>
          n.neighborhood_name.toLowerCase().includes(q) ||
          (n.leader_name && n.leader_name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [neighborhoods, selectedDistrict, selectedWard, filteredWards, searchQuery]);

  // Parse polygon for leaflet helper
  const parsedPolygons = useMemo(() => {
    const polys: Record<string, [number, number][]> = {};
    neighborhoods.forEach(n => {
      if (n.geojson_polygon) {
        try {
          const geojson = JSON.parse(n.geojson_polygon);
          if (geojson && geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
            // GeoJSON coordinates are [ [ [lng, lat], [lng, lat], ... ] ]
            // Leaflet Polygon needs [ [lat, lng], [lat, lng], ... ]
            const rawCoords = geojson.coordinates[0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            // Remove last element if it closes the polygon, Leaflet does it automatically
            if (
              leafletCoords.length > 1 &&
              leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] &&
              leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]
            ) {
              leafletCoords.pop();
            }
            polys[n.name] = leafletCoords;
          }
        } catch (e) {
          console.warn('Failed to parse polygon for Neighborhood ' + n.name, e);
        }
      }
    });
    return polys;
  }, [neighborhoods]);

  // Parse Ward polygon helper
  const parsedWardPolygons = useMemo(() => {
    const polys: Record<string, [number, number][]> = {};
    wards.forEach(w => {
      if (w.geojson_boundary) {
        try {
          const geojson = JSON.parse(w.geojson_boundary);
          if (geojson && geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
            const rawCoords = geojson.coordinates[0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            polys[w.name] = leafletCoords;
          } else if (geojson && geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
            const rawCoords = geojson.coordinates[0][0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            polys[w.name] = leafletCoords;
          }
        } catch (e) {
          console.warn('Failed to parse polygon for Ward ' + w.name, e);
        }
      }
    });
    return polys;
  }, [wards]);

  // Fit bounds target
  const mapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (selectedNbName && parsedPolygons[selectedNbName]) {
      return L.latLngBounds(parsedPolygons[selectedNbName]);
    }
    // Default fit bounds to all visible polygons if any
    const activePolys = filteredNeighborhoods
      .map(n => parsedPolygons[n.name])
      .filter(Boolean);
    if (activePolys.length > 0) {
      const bounds = L.latLngBounds([]);
      activePolys.forEach(poly => poly.forEach(pt => bounds.extend(pt)));
      return bounds;
    }
    return null;
  }, [selectedNbName, filteredNeighborhoods, parsedPolygons]);

  // Map Click Handler (Drawing Vertices)
  const handleMapClick = (latlng: L.LatLng) => {
    setDrawVertices(prev => [...prev, [latlng.lat, latlng.lng]]);
  };

  // Undo last vertex
  const handleUndoDraw = () => {
    setDrawVertices(prev => prev.slice(0, -1));
  };

  // Clear all vertices
  const handleClearDraw = () => {
    setDrawVertices([]);
  };

  // Save boundary
  const handleSaveBoundary = async () => {
    if (!selectedNbName) return;
    if (drawVertices.length < 3) {
      alert('Vui lòng vẽ đa giác có ít nhất 3 điểm ranh giới.');
      return;
    }

    // Prepare GeoJSON Polygon format
    // Must close the loop by repeating the first vertex
    const coords = [...drawVertices, drawVertices[0]].map(v => [v[1], v[0]]); // [lng, lat]
    const geojson = {
      type: 'Polygon',
      coordinates: [coords]
    };

    try {
      setLoading(true);
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'Neighborhood',
        name: selectedNbName,
        fieldname: 'geojson_polygon',
        value: JSON.stringify(geojson)
      });
      alert('Đã cập nhật ranh giới tổ dân phố thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchNeighborhoods();
    } catch (e) {
      alert('Lỗi khi lưu ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Delete boundary from database
  const handleDeleteBoundary = async () => {
    if (!selectedNbName) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ranh giới của tổ dân phố này?')) return;

    try {
      setLoading(true);
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'Neighborhood',
        name: selectedNbName,
        fieldname: 'geojson_polygon',
        value: ''
      });
      alert('Đã xóa ranh giới thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchNeighborhoods();
    } catch (e) {
      alert('Lỗi khi xóa ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Neighborhood
  const handleAddNb = async () => {
    if (!newNb.neighborhood_name) return alert('Vui lòng nhập tên Tổ dân phố!');
    if (!newNb.ward) return alert('Vui lòng chọn Phường/Xã!');

    try {
      setLoading(true);
      const res = await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Neighborhood',
          ...newNb
        }
      });
      const insertedDoc = res.data.message;
      alert('Thêm Tổ dân phố mới thành công!');
      setIsAddOpen(false);
      setNewNb({ neighborhood_name: '', ward: '', leader_name: '' });
      await fetchNeighborhoods();
      // Select the newly created block and prompt to draw boundary
      setSelectedNbName(insertedDoc.name);
      setDrawVertices([]);
      setIsDrawMode(true);
    } catch (e) {
      alert('Lỗi khi thêm tổ dân phố: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit Neighborhood
  const handleEditNb = async () => {
    if (!editNb.neighborhood_name) return alert('Vui lòng nhập tên Tổ dân phố!');
    if (!editNb.ward) return alert('Vui lòng chọn Phường/Xã!');

    try {
      setLoading(true);
      await api.put(`/api/resource/Neighborhood/${editNb.name}`, {
        neighborhood_name: editNb.neighborhood_name,
        ward: editNb.ward,
        leader_name: editNb.leader_name
      });
      alert('Cập nhật thông tin Tổ dân phố thành công!');
      setIsEditOpen(false);
      await fetchNeighborhoods();
    } catch (e) {
      alert('Lỗi khi cập nhật tổ dân phố: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Neighborhood
  const handleDeleteNb = async () => {
    if (!deleteReason.trim()) return alert("Vui lòng nhập lý do xóa");
    if (!deletingNb) return;
    
    setIsDeleting(true);
    try {
      // 0. Handle Affected Households
      if (affectedHouseholds.length > 0) {
        if (deleteOption === 'reassign' && reassignNb) {
          // Reassign
          for (let hh of affectedHouseholds) {
            await api.post('/api/method/frappe.client.set_value', {
              doctype: 'Household',
              name: hh.name,
              fieldname: 'neighborhood',
              value: reassignNb
            });
          }
        } else {
          // Orphan
          for (let hh of affectedHouseholds) {
            await api.post('/api/method/frappe.client.set_value', {
              doctype: 'Household',
              name: hh.name,
              fieldname: 'neighborhood',
              value: ''
            });
          }
        }
      }

      // 1. Create Deletion History log
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Deletion History',
          entity_type: 'Tổ dân phố',
          entity_id: deletingNb.name,
          entity_name: `Tổ: ${deletingNb.neighborhood_name}`,
          reason: deleteReason,
          deleted_by: 'Administrator',
          deleted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
          deleted_data: JSON.stringify(deletingNb)
        }
      });
      
      // 2. Delete Neighborhood document
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'Neighborhood',
        name: deletingNb.name
      });
      
      alert("Xóa Tổ dân phố thành công!");
      setIsDeleteOpen(false);
      setDeleteReason('');
      setDeletingNb(null);
      setSelectedNbName(null);
      setIsDrawMode(false);
      setDrawVertices([]);
      
      fetchNeighborhoods();
    } catch (e: any) {
      alert("Lỗi khi xóa: " + (e.response?.data?.message || e.message || JSON.stringify(e)));
    } finally {
      setIsDeleting(false);
    }
  };

  // Ward mapping for displaying name
  const wardMap = useMemo(() => {
    const map = new Map<string, string>();
    wards.forEach(w => map.set(w.name, w.ward_name));
    return map;
  }, [wards]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Panel */}
      <div className="w-[420px] bg-white border-r flex flex-col shadow-md z-10">
        <div className="p-4 border-b flex flex-col gap-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>Tổ chức</span> &gt; <span className="font-semibold text-blue-600">Tổ dân phố</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Map20Regular className="text-blue-600" />
            <Title1 className="text-lg font-bold text-gray-800">Quản lý Tổ dân phố</Title1>
          </div>
          <p className="text-xs text-gray-500 italic mt-1">
            Click vào tổ để xem vùng bao. Click polygon trên bản đồ để chọn ngược lại.
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 block mb-1">
                Quận/Huyện
              </label>
              <Select
                size="small"
                className="w-full"
                value={selectedDistrict}
                onChange={e => {
                  setSelectedDistrict(e.target.value);
                  setSelectedWard('');
                }}
              >
                <option value="">Tất cả</option>
                {districts.map(d => (
                  <option key={d.name} value={d.name}>
                    {d.district_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 block mb-1">
                Phường/Xã
              </label>
              <Select
                size="small"
                className="w-full"
                value={selectedWard}
                onChange={e => setSelectedWard(e.target.value)}
                disabled={!selectedDistrict}
              >
                <option value="">Tất cả</option>
                {filteredWards.map(w => (
                  <option key={w.name} value={w.name}>
                    {w.ward_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Input
              size="small"
              className="w-full"
              contentBefore={<Search20Regular />}
              placeholder="Tìm theo tên tổ, tổ trưởng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && neighborhoods.length === 0 ? (
            <div className="flex justify-center p-8">
              <Spinner label="Đang tải dữ liệu..." />
            </div>
          ) : filteredNeighborhoods.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-sm">Không tìm thấy tổ dân phố nào</div>
          ) : (
            filteredNeighborhoods.map(n => {
              const hasPoly = !!parsedPolygons[n.name];
              const isSelected = selectedNbName === n.name;
              return (
                <div
                  key={n.name}
                  onClick={() => {
                    if (isDrawMode) {
                      if (window.confirm('Bạn đang vẽ ranh giới chưa lưu. Hủy bản vẽ hiện tại?')) {
                        setIsDrawMode(false);
                        setDrawVertices([]);
                      } else {
                        return;
                      }
                    }
                    setSelectedNbName(isSelected ? null : n.name);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-800">{n.neighborhood_name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        📍 Phường: {wardMap.get(n.ward) || n.ward}
                      </p>
                      {n.leader_name && (
                        <p className="text-xs text-blue-700 font-medium mt-0.5">
                          👤 Tổ trưởng: {n.leader_name}
                        </p>
                      )}
                    </div>
                    <div>
                      {hasPoly ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                          Đã vẽ ranh giới
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                          Chưa vẽ ranh giới
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Panel */}
        <div className="p-4 border-t bg-gray-50">
          <Button
            appearance="primary"
            icon={<Add20Regular />}
            onClick={() => {
              if (isDrawMode) {
                alert('Vui lòng hoàn thành hoặc hủy bản vẽ hiện tại trước.');
                return;
              }
              setIsAddOpen(true);
            }}
            className="w-full"
          >
            Thêm Tổ dân phố
          </Button>
        </div>
      </div>

      {/* Map View */}
      <div className="flex-1 relative">
        <MapContainer
          center={DA_NANG_CENTER}
          zoom={DA_NANG_ZOOM}
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution="&copy; Google Maps"
          />

          <FitBounds bounds={mapBounds} />
          <MapClickEvents onMapClick={handleMapClick} enabled={isDrawMode} />

          {/* Render Ward Polygon */}
          {(() => {
            const activeWardName = selectedNbName 
                ? neighborhoods.find(n => n.name === selectedNbName)?.ward 
                : selectedWard;
            
            if (activeWardName && parsedWardPolygons[activeWardName]) {
              return (
                <Polygon
                  positions={parsedWardPolygons[activeWardName]}
                  pathOptions={{
                    color: '#f97316', // Orange
                    fillColor: 'transparent',
                    weight: 3,
                    dashArray: '8, 8'
                  }}
                  interactive={false}
                />
              );
            }
            return null;
          })()}

          {/* Render Existing Polygons */}
          {filteredNeighborhoods.map(n => {
            const poly = parsedPolygons[n.name];
            if (!poly) return null;

            const isSelected = selectedNbName === n.name;
            return (
              <Polygon
                key={n.name}
                positions={poly}
                pathOptions={{
                  color: isSelected ? '#ef4444' : '#3b82f6',
                  fillColor: isSelected ? '#ef4444' : '#3b82f6',
                  fillOpacity: isSelected ? 0.3 : 0.15,
                  weight: isSelected ? 3 : 1.5
                }}
                eventHandlers={{
                  click: () => {
                    if (isDrawMode) return;
                    setSelectedNbName(isSelected ? null : n.name);
                  }
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{n.neighborhood_name}</strong>
                    <br />
                    Tổ trưởng: {n.leader_name || 'Chưa cập nhật'}
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}

          {/* Render Temporary Drawing Vertices & Polyline */}
          {isDrawMode && drawVertices.length > 0 && (
            <>
              {/* Vertices */}
              {drawVertices.map((v, idx) => (
                <Marker
                  key={idx}
                  position={v}
                  icon={L.divIcon({
                    className: '',
                    html: '<div style="background:#dc2626;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;"></div>',
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                  })}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target;
                      const position = marker.getLatLng();
                      setDrawVertices(prev => {
                        const newVertices = [...prev];
                        newVertices[idx] = [position.lat, position.lng];
                        return newVertices;
                      });
                    },
                    dblclick: () => {
                      setDrawVertices(prev => prev.filter((_, i) => i !== idx));
                    }
                  }}
                >
                  <Tooltip>Kéo để di chuyển điểm. Double-click để xóa điểm.</Tooltip>
                </Marker>
              ))}

              {/* Connecting Lines */}
              {drawVertices.length >= 2 && (
                <Polygon
                  positions={drawVertices}
                  pathOptions={{
                    color: '#dc2626',
                    dashArray: '5, 5',
                    fillColor: '#dc2626',
                    fillOpacity: 0.1,
                    weight: 2
                  }}
                />
              )}
            </>
          )}
        </MapContainer>

        {/* Floating Controls Overlay */}
        {selectedNbName && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-lg border border-gray-200 p-4 rounded-xl max-w-sm z-[1000] flex flex-col gap-2 transition-all duration-300">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              📍 {neighborhoods.find(n => n.name === selectedNbName)?.neighborhood_name}
            </h3>

            {!isDrawMode ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="small"
                  appearance="primary"
                  icon={<Edit20Regular />}
                  onClick={() => {
                    setDrawVertices(parsedPolygons[selectedNbName] || []);
                    setIsDrawMode(true);
                  }}
                >
                  {parsedPolygons[selectedNbName] ? 'Sửa ranh giới' : 'Vẽ ranh giới'}
                </Button>
                {parsedPolygons[selectedNbName] && (
                  <Button
                    size="small"
                    appearance="secondary"
                    style={{ color: '#dc2626', borderColor: '#dc2626' }}
                    onClick={handleDeleteBoundary}
                  >
                    Xóa ranh giới
                  </Button>
                )}
                <Button
                  size="small"
                  appearance="outline"
                  onClick={() => {
                    const nb = neighborhoods.find(n => n.name === selectedNbName);
                    if (nb) {
                      setEditNb({ name: nb.name, neighborhood_name: nb.neighborhood_name, ward: nb.ward, leader_name: nb.leader_name || '' });
                      setIsEditOpen(true);
                    }
                  }}
                >
                  Sửa thông tin
                </Button>
                <Button
                  size="small"
                  appearance="secondary"
                  style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={async () => {
                    const nb = neighborhoods.find(n => n.name === selectedNbName);
                    if (nb) {
                      setDeletingNb({ name: nb.name, neighborhood_name: nb.neighborhood_name });
                      setDeleteReason('');
                      setDeleteOption('reassign');
                      setReassignNb('');
                      try {
                        setLoading(true);
                        const res = await api.get('/api/method/frappe.client.get_list', {
                          params: {
                            doctype: 'Household',
                            filters: JSON.stringify([['neighborhood', '=', nb.name]]),
                            fields: '["name"]',
                            limit_page_length: 0
                          }
                        });
                        setAffectedHouseholds(res.data.message || []);
                      } catch (e) {
                        console.error(e);
                        setAffectedHouseholds([]);
                      } finally {
                        setLoading(false);
                      }
                      setIsDeleteOpen(true);
                    }
                  }}
                >
                  Xóa Tổ
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  onClick={() => setSelectedNbName(null)}
                >
                  Đóng
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded border border-red-100 font-medium">
                  Chế độ vẽ: Click lên bản đồ để vẽ điểm mới. Kéo các điểm (nút đỏ) để di chuyển, hoặc double-click vào một điểm để xóa.
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="small"
                    appearance="primary"
                    icon={<Checkmark20Regular />}
                    onClick={handleSaveBoundary}
                    disabled={drawVertices.length < 3}
                  >
                    Lưu
                  </Button>
                  <Button
                    size="small"
                    appearance="outline"
                    icon={<ArrowUndo20Regular />}
                    onClick={handleUndoDraw}
                    disabled={drawVertices.length === 0}
                  >
                    Hoàn tác
                  </Button>
                  <Button
                    size="small"
                    appearance="outline"
                    icon={<Dismiss20Regular />}
                    onClick={handleClearDraw}
                    disabled={drawVertices.length === 0}
                  >
                    Xóa tất cả
                  </Button>
                  <Button
                    size="small"
                    appearance="secondary"
                    onClick={() => {
                      setIsDrawMode(false);
                      setDrawVertices([]);
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(_, d) => setIsAddOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Thêm Tổ dân phố mới</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên tổ dân phố (Ví dụ: Tổ dân phố 15)">
                <Input
                  value={newNb.neighborhood_name}
                  onChange={e => setNewNb({ ...newNb, neighborhood_name: e.target.value })}
                  placeholder="Nhập tên tổ..."
                />
              </Field>
              <Field label="Phường/Xã trực thuộc">
                <Select
                  value={newNb.ward}
                  onChange={e => setNewNb({ ...newNb, ward: e.target.value })}
                >
                  <option value="">- Chọn Phường/Xã -</option>
                  {wards.map(w => (
                    <option key={w.name} value={w.name}>
                      {w.ward_name} ({w.district})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Họ tên Tổ trưởng (Không bắt buộc)">
                <Input
                  value={newNb.leader_name}
                  onChange={e => setNewNb({ ...newNb, leader_name: e.target.value })}
                  placeholder="Nhập tên tổ trưởng..."
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleAddNb}>
                Tạo tổ dân phố
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(_, d) => setIsEditOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Sửa thông tin Tổ dân phố</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên tổ dân phố (Ví dụ: Tổ dân phố 15)">
                <Input
                  value={editNb.neighborhood_name}
                  onChange={e => setEditNb({ ...editNb, neighborhood_name: e.target.value })}
                  placeholder="Nhập tên tổ..."
                />
              </Field>
              <Field label="Phường/Xã trực thuộc">
                <Select
                  value={editNb.ward}
                  onChange={e => setEditNb({ ...editNb, ward: e.target.value })}
                >
                  <option value="">- Chọn Phường/Xã -</option>
                  {wards.map(w => (
                    <option key={w.name} value={w.name}>
                      {w.ward_name} ({w.district})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Họ tên Tổ trưởng (Không bắt buộc)">
                <Input
                  value={editNb.leader_name}
                  onChange={e => setEditNb({ ...editNb, leader_name: e.target.value })}
                  placeholder="Nhập tên tổ trưởng..."
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleEditNb}>
                Cập nhật
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={(_, d) => setIsDeleteOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle className="text-red-600">Xóa Tổ dân phố</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">Bạn có chắc chắn muốn xóa Tổ dân phố này không? Hành động này không thể hoàn tác.</p>
                <p className="font-bold">{deletingNb?.neighborhood_name}</p>
              </div>
              
              {affectedHouseholds.length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg space-y-3">
                  <p className="text-sm text-yellow-800 font-bold">
                    ⚠️ Chú ý: Tổ dân phố này đang chứa {affectedHouseholds.length} Hộ gia đình.
                  </p>
                  <p className="text-sm text-yellow-800">
                    Vui lòng chọn Tổ dân phố khác để chuyển các hộ này sang trước khi xóa:
                  </p>
                  
                  <div className="mt-3">
                    <Select
                      value={reassignNb}
                      onChange={e => setReassignNb(e.target.value)}
                      className="w-full"
                    >
                      <option value="">- Chọn Tổ dân phố để chuyển đến -</option>
                      {neighborhoods.filter(n => n.name !== deletingNb?.name).map(n => (
                        <option key={n.name} value={n.name}>
                          {n.neighborhood_name} ({wards.find(w => w.name === n.ward)?.ward_name})
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              <Field label="Lý do xóa (Bắt buộc)">
                <textarea 
                   className="w-full border border-gray-300 rounded p-2 text-sm" 
                   rows={3} 
                   placeholder="Nhập lý do tại sao xóa tổ dân phố này..."
                   value={deleteReason}
                   onChange={e => setDeleteReason(e.target.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Hủy</Button>
              <Button 
                appearance="primary" 
                style={{ backgroundColor: '#dc2626', color: '#fff' }} 
                onClick={handleDeleteNb} 
                disabled={isDeleting || !deleteReason.trim() || (affectedHouseholds.length > 0 && deleteOption === 'reassign' && !reassignNb)}
              >
                {isDeleting ? <Spinner size="tiny" /> : "Xác nhận Xóa"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
