import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
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

interface DistrictData { name: string; district_name: string; geojson_boundary?: string; }
interface WardData { name: string; ward_name: string; district: string; headquarters?: string; geojson_boundary?: string; }

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

export default function WardList() {
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Item
  const [selectedWardName, setSelectedWardName] = useState<string | null>(null);

  // Drawing State
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);

  // Add Ward State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newWard, setNewWard] = useState({ ward_name: '', district: '' });

  // Edit Ward State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editWard, setEditWard] = useState({ name: '', ward_name: '', district: '' });

  // Delete Ward State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingWard, setDeletingWard] = useState<{name: string, ward_name: string} | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Districts
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await api.get('/api/method/frappe.client.get_list', {
          params: { doctype: 'District', fields: '["name","district_name","geojson_boundary"]', limit_page_length: 0 }
        });
        setDistricts(res.data.message || []);
      } catch (e) {
        console.error(e);
      }
    };
    fetchDistricts();
  }, []);

  // Fetch Wards
  const fetchWards = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: {
          doctype: 'Ward',
          fields: '["name","ward_name","district","headquarters","geojson_boundary"]',
          limit_page_length: 0
        }
      });
      setWards(res.data.message || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWards();
  }, []);

  // Filtered Wards List
  const filteredWards = useMemo(() => {
    let list = wards;
    if (selectedDistrict) {
      list = list.filter(w => w.district === selectedDistrict);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        w => w.ward_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [wards, selectedDistrict, searchQuery]);

  // Parse polygon for leaflet helper (Wards)
  const parsedPolygons = useMemo(() => {
    const polys: Record<string, [number, number][]> = {};
    wards.forEach(w => {
      if (w.geojson_boundary) {
        try {
          const geojson = JSON.parse(w.geojson_boundary);
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

  // Parse District polygon helper
  const parsedDistrictPolygons = useMemo(() => {
    const polys: Record<string, [number, number][]> = {};
    districts.forEach(d => {
      if (d.geojson_boundary) {
        try {
          const geojson = JSON.parse(d.geojson_boundary);
          if (geojson && geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
            const rawCoords = geojson.coordinates[0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            polys[d.name] = leafletCoords;
          } else if (geojson && geojson.type === 'MultiPolygon' && Array.isArray(geojson.coordinates)) {
            const rawCoords = geojson.coordinates[0][0];
            const leafletCoords = rawCoords.map((c: any) => [c[1], c[0]] as [number, number]);
            polys[d.name] = leafletCoords;
          }
        } catch (e) {
          console.warn('Failed to parse polygon for District ' + d.name, e);
        }
      }
    });
    return polys;
  }, [districts]);

  // Fit bounds target
  const mapBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (selectedWardName && parsedPolygons[selectedWardName]) {
      return L.latLngBounds(parsedPolygons[selectedWardName]);
    }
    // Default fit bounds to all visible polygons if any
    const activePolys = filteredWards
      .map(w => parsedPolygons[w.name])
      .filter(Boolean);
    if (activePolys.length > 0) {
      const bounds = L.latLngBounds([]);
      activePolys.forEach(poly => poly.forEach(pt => bounds.extend(pt)));
      return bounds;
    }
    return null;
  }, [selectedWardName, filteredWards, parsedPolygons]);

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
    if (!selectedWardName) return;
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
        doctype: 'Ward',
        name: selectedWardName,
        fieldname: 'geojson_boundary',
        value: JSON.stringify(geojson)
      });
      alert('Đã cập nhật ranh giới phường/xã thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchWards();
    } catch (e) {
      alert('Lỗi khi lưu ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Delete boundary from database
  const handleDeleteBoundary = async () => {
    if (!selectedWardName) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ranh giới của phường/xã này?')) return;

    try {
      setLoading(true);
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'Ward',
        name: selectedWardName,
        fieldname: 'geojson_boundary',
        value: ''
      });
      alert('Đã xóa ranh giới thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchWards();
    } catch (e) {
      alert('Lỗi khi xóa ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add Ward
  const handleAddWard = async () => {
    if (!newWard.ward_name) return alert('Vui lòng nhập tên Phường/Xã!');
    if (!newWard.district) return alert('Vui lòng chọn Quận/Huyện!');

    try {
      setLoading(true);
      const res = await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Ward',
          ...newWard
        }
      });
      const insertedDoc = res.data.message;
      alert('Thêm Phường/Xã mới thành công!');
      setIsAddOpen(false);
      setNewWard({ ward_name: '', district: '' });
      await fetchWards();
      // Select the newly created ward and prompt to draw boundary
      setSelectedWardName(insertedDoc.name);
      setDrawVertices([]);
      setIsDrawMode(true);
    } catch (e) {
      alert('Lỗi khi thêm phường/xã: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit Ward
  const handleEditWard = async () => {
    if (!editWard.ward_name) return alert('Vui lòng nhập tên Phường/Xã!');
    if (!editWard.district) return alert('Vui lòng chọn Quận/Huyện!');

    try {
      setLoading(true);
      await api.put(`/api/resource/Ward/${editWard.name}`, {
        ward_name: editWard.ward_name,
        district: editWard.district
      });
      alert('Cập nhật thông tin Phường/Xã thành công!');
      setIsEditOpen(false);
      await fetchWards();
    } catch (e) {
      alert('Lỗi khi cập nhật phường/xã: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Ward
  const handleDeleteWard = async () => {
    if (!deleteReason.trim()) return alert("Vui lòng nhập lý do xóa");
    if (!deletingWard) return;
    
    setIsDeleting(true);
    try {
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Deletion History',
          entity_type: 'Phường/Xã',
          entity_id: deletingWard.name,
          entity_name: `Phường: ${deletingWard.ward_name}`,
          reason: deleteReason,
          deleted_by: 'Administrator',
          deleted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
          deleted_data: JSON.stringify(deletingWard)
        }
      });
      
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'Ward',
        name: deletingWard.name
      });
      
      alert("Xóa Phường/Xã thành công!");
      setIsDeleteOpen(false);
      setDeleteReason('');
      setDeletingWard(null);
      setSelectedWardName(null);
      setIsDrawMode(false);
      setDrawVertices([]);
      
      fetchWards();
    } catch (e: any) {
      alert("Lỗi khi xóa: " + (e.response?.data?.message || e.message || JSON.stringify(e)));
    } finally {
      setIsDeleting(false);
    }
  };

  // District mapping for displaying name
  const districtMap = useMemo(() => {
    const map = new Map<string, string>();
    districts.forEach(d => map.set(d.name, d.district_name));
    return map;
  }, [districts]);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Panel */}
      <div className="w-[420px] bg-white border-r flex flex-col shadow-md z-10">
        <div className="p-4 border-b flex flex-col gap-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>Tổ chức</span> &gt; <span className="font-semibold text-blue-600">Phường / Xã</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Map20Regular className="text-blue-600" />
            <Title1 className="text-lg font-bold text-gray-800">Quản lý Phường / Xã</Title1>
          </div>
          <p className="text-xs text-gray-500 italic mt-1">
            Click vào phường để xem vùng bao. Click polygon trên bản đồ để chọn ngược lại.
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 flex flex-col gap-3">
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
              }}
            >
              <option value="">Tất cả Quận/Huyện</option>
              {districts.map(d => (
                <option key={d.name} value={d.name}>
                  {d.district_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Input
              size="small"
              className="w-full"
              contentBefore={<Search20Regular />}
              placeholder="Tìm theo tên phường/xã..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && wards.length === 0 ? (
            <div className="flex justify-center p-8">
              <Spinner label="Đang tải dữ liệu..." />
            </div>
          ) : filteredWards.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-sm">Không tìm thấy phường/xã nào</div>
          ) : (
            filteredWards.map(w => {
              const hasPoly = !!parsedPolygons[w.name];
              const isSelected = selectedWardName === w.name;
              return (
                <div
                  key={w.name}
                  onClick={() => {
                    if (isDrawMode) {
                      if (window.confirm('Bạn đang vẽ ranh giới chưa lưu. Hủy bản vẽ hiện tại?')) {
                        setIsDrawMode(false);
                        setDrawVertices([]);
                      } else {
                        return;
                      }
                    }
                    setSelectedWardName(isSelected ? null : w.name);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-800">{w.ward_name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        📍 Quận: {districtMap.get(w.district) || w.district}
                      </p>
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
            Thêm Phường / Xã
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

          {/* Render District Polygon */}
          {(() => {
            const activeDistrictName = selectedWardName 
                ? wards.find(w => w.name === selectedWardName)?.district 
                : selectedDistrict;
            
            if (activeDistrictName && parsedDistrictPolygons[activeDistrictName]) {
              return (
                <Polygon
                  positions={parsedDistrictPolygons[activeDistrictName]}
                  pathOptions={{
                    color: '#8b5cf6', // Purple
                    fillColor: 'transparent',
                    weight: 3,
                    dashArray: '10, 10'
                  }}
                  interactive={false}
                />
              );
            }
            return null;
          })()}

          {/* Render Existing Polygons */}
          {filteredWards.map(w => {
            const poly = parsedPolygons[w.name];
            if (!poly) return null;

            const isSelected = selectedWardName === w.name;
            return (
              <Polygon
                key={w.name}
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
                    setSelectedWardName(isSelected ? null : w.name);
                  }
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{w.ward_name}</strong>
                    <br />
                    Quận: {districtMap.get(w.district) || w.district}
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
        {selectedWardName && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-lg border border-gray-200 p-4 rounded-xl max-w-sm z-[1000] flex flex-col gap-2 transition-all duration-300">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              📍 {wards.find(w => w.name === selectedWardName)?.ward_name}
            </h3>

            {!isDrawMode ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="small"
                  appearance="primary"
                  icon={<Edit20Regular />}
                  onClick={() => {
                    setDrawVertices(parsedPolygons[selectedWardName] || []);
                    setIsDrawMode(true);
                  }}
                >
                  {parsedPolygons[selectedWardName] ? 'Sửa ranh giới' : 'Vẽ ranh giới'}
                </Button>
                {parsedPolygons[selectedWardName] && (
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
                    const w = wards.find(x => x.name === selectedWardName);
                    if (w) {
                      setEditWard({ name: w.name, ward_name: w.ward_name, district: w.district });
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
                  onClick={() => {
                    const w = wards.find(x => x.name === selectedWardName);
                    if (w) {
                      setDeletingWard({ name: w.name, ward_name: w.ward_name });
                      setDeleteReason('');
                      setIsDeleteOpen(true);
                    }
                  }}
                >
                  Xóa Phường
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  onClick={() => setSelectedWardName(null)}
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
            <DialogTitle>Thêm Phường/Xã mới</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên Phường/Xã (Ví dụ: Phường Hòa Thuận Đông)">
                <Input
                  value={newWard.ward_name}
                  onChange={e => setNewWard({ ...newWard, ward_name: e.target.value })}
                  placeholder="Nhập tên phường/xã..."
                />
              </Field>
              <Field label="Quận/Huyện trực thuộc">
                <Select
                  value={newWard.district}
                  onChange={e => setNewWard({ ...newWard, district: e.target.value })}
                >
                  <option value="">- Chọn Quận/Huyện -</option>
                  {districts.map(d => (
                    <option key={d.name} value={d.name}>
                      {d.district_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleAddWard}>
                Tạo phường/xã
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(_, d) => setIsEditOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Sửa thông tin Phường/Xã</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên Phường/Xã (Ví dụ: Phường Hòa Thuận Đông)">
                <Input
                  value={editWard.ward_name}
                  onChange={e => setEditWard({ ...editWard, ward_name: e.target.value })}
                  placeholder="Nhập tên phường/xã..."
                />
              </Field>
              <Field label="Quận/Huyện trực thuộc">
                <Select
                  value={editWard.district}
                  onChange={e => setEditWard({ ...editWard, district: e.target.value })}
                >
                  <option value="">- Chọn Quận/Huyện -</option>
                  {districts.map(d => (
                    <option key={d.name} value={d.name}>
                      {d.district_name}
                    </option>
                  ))}
                </Select>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleEditWard}>
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
            <DialogTitle className="text-red-600">Xóa Phường/Xã</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">Bạn có chắc chắn muốn xóa Phường/Xã này không? Hành động này không thể hoàn tác.</p>
                <p className="font-bold">{deletingWard?.ward_name}</p>
              </div>
              <Field label="Lý do xóa (Bắt buộc)">
                <textarea 
                   className="w-full border border-gray-300 rounded p-2 text-sm" 
                   rows={3} 
                   placeholder="Nhập lý do tại sao xóa phường/xã này..."
                   value={deleteReason}
                   onChange={e => setDeleteReason(e.target.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Hủy</Button>
              <Button appearance="primary" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={handleDeleteWard} disabled={isDeleting || !deleteReason.trim()}>
                {isDeleting ? <Spinner size="tiny" /> : "Xác nhận Xóa"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
