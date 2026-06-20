import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import {
  Button, Input, Title1, Dialog, DialogSurface, DialogTitle, DialogBody,
  DialogActions, DialogContent, Field, Spinner
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
const DA_NANG_ZOOM = 11; // Zoom out a bit for districts

interface DistrictData { name: string; district_name: string; administrative_code?: string; geojson_boundary?: string; }

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

export default function DistrictList() {
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Item
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);

  // Drawing State
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);

  // Add District State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDistrict, setNewDistrict] = useState({ district_name: '', administrative_code: '' });

  // Edit District State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDistrict, setEditDistrict] = useState({ name: '', district_name: '', administrative_code: '' });

  // Delete District State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingDistrict, setDeletingDistrict] = useState<{name: string, district_name: string} | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Districts
  const fetchDistricts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: {
          doctype: 'District',
          fields: '["name","district_name","administrative_code","geojson_boundary"]',
          limit_page_length: 0
        }
      });
      setDistricts(res.data.message || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
  }, []);

  // Filtered Districts List
  const filteredDistricts = useMemo(() => {
    let list = districts;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        d => d.district_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [districts, searchQuery]);

  // Parse polygon for leaflet helper (Districts)
  const parsedPolygons = useMemo(() => {
    const polys: Record<string, [number, number][]> = {};
    districts.forEach(d => {
      if (d.geojson_boundary) {
        try {
          const geojson = JSON.parse(d.geojson_boundary);
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
    if (selectedDistrictName && parsedPolygons[selectedDistrictName]) {
      return L.latLngBounds(parsedPolygons[selectedDistrictName]);
    }
    // Default fit bounds to all visible polygons if any
    const activePolys = filteredDistricts
      .map(d => parsedPolygons[d.name])
      .filter(Boolean);
    if (activePolys.length > 0) {
      const bounds = L.latLngBounds([]);
      activePolys.forEach(poly => poly.forEach(pt => bounds.extend(pt)));
      return bounds;
    }
    return null;
  }, [selectedDistrictName, filteredDistricts, parsedPolygons]);

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
    if (!selectedDistrictName) return;
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
        doctype: 'District',
        name: selectedDistrictName,
        fieldname: 'geojson_boundary',
        value: JSON.stringify(geojson)
      });
      alert('Đã cập nhật ranh giới quận/huyện thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchDistricts();
    } catch (e) {
      alert('Lỗi khi lưu ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Delete boundary from database
  const handleDeleteBoundary = async () => {
    if (!selectedDistrictName) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa ranh giới của quận/huyện này?')) return;

    try {
      setLoading(true);
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'District',
        name: selectedDistrictName,
        fieldname: 'geojson_boundary',
        value: ''
      });
      alert('Đã xóa ranh giới thành công!');
      setIsDrawMode(false);
      setDrawVertices([]);
      fetchDistricts();
    } catch (e) {
      alert('Lỗi khi xóa ranh giới: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Add District
  const handleAddDistrict = async () => {
    if (!newDistrict.district_name) return alert('Vui lòng nhập tên Quận/Huyện!');

    try {
      setLoading(true);
      const res = await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'District',
          ...newDistrict
        }
      });
      const insertedDoc = res.data.message;
      alert('Thêm Quận/Huyện mới thành công!');
      setIsAddOpen(false);
      setNewDistrict({ district_name: '', administrative_code: '' });
      await fetchDistricts();
      // Select the newly created district and prompt to draw boundary
      setSelectedDistrictName(insertedDoc.name);
      setDrawVertices([]);
      setIsDrawMode(true);
    } catch (e) {
      alert('Lỗi khi thêm quận/huyện: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit District
  const handleEditDistrict = async () => {
    if (!editDistrict.district_name) return alert('Vui lòng nhập tên Quận/Huyện!');

    try {
      setLoading(true);
      await api.put(`/api/resource/District/${editDistrict.name}`, {
        district_name: editDistrict.district_name,
        administrative_code: editDistrict.administrative_code
      });
      alert('Cập nhật thông tin Quận/Huyện thành công!');
      setIsEditOpen(false);
      await fetchDistricts();
    } catch (e) {
      alert('Lỗi khi cập nhật quận/huyện: ' + e);
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete District
  const handleDeleteDistrict = async () => {
    if (!deleteReason.trim()) return alert("Vui lòng nhập lý do xóa");
    if (!deletingDistrict) return;
    
    setIsDeleting(true);
    try {
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Deletion History',
          entity_type: 'Quận/Huyện',
          entity_id: deletingDistrict.name,
          entity_name: `Quận/Huyện: ${deletingDistrict.district_name}`,
          reason: deleteReason,
          deleted_by: 'Administrator',
          deleted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
          deleted_data: JSON.stringify(deletingDistrict)
        }
      });
      
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'District',
        name: deletingDistrict.name
      });
      
      alert("Xóa Quận/Huyện thành công!");
      setIsDeleteOpen(false);
      setDeleteReason('');
      setDeletingDistrict(null);
      setSelectedDistrictName(null);
      setIsDrawMode(false);
      setDrawVertices([]);
      
      fetchDistricts();
    } catch (e: any) {
      alert("Lỗi khi xóa: " + (e.response?.data?.message || e.message || JSON.stringify(e)));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Panel */}
      <div className="w-[420px] bg-white border-r flex flex-col shadow-md z-10">
        <div className="p-4 border-b flex flex-col gap-1">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>Tổ chức</span> &gt; <span className="font-semibold text-blue-600">Quận / Huyện</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Map20Regular className="text-blue-600" />
            <Title1 className="text-lg font-bold text-gray-800">Quản lý Quận / Huyện</Title1>
          </div>
          <p className="text-xs text-gray-500 italic mt-1">
            Click vào quận/huyện để xem vùng bao. Click polygon trên bản đồ để chọn ngược lại.
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 border-b bg-gray-50 flex flex-col gap-3">
          <div>
            <Input
              size="small"
              className="w-full"
              contentBefore={<Search20Regular />}
              placeholder="Tìm theo tên quận/huyện..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && districts.length === 0 ? (
            <div className="flex justify-center p-8">
              <Spinner label="Đang tải dữ liệu..." />
            </div>
          ) : filteredDistricts.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-sm">Không tìm thấy quận/huyện nào</div>
          ) : (
            filteredDistricts.map(d => {
              const hasPoly = !!parsedPolygons[d.name];
              const isSelected = selectedDistrictName === d.name;
              return (
                <div
                  key={d.name}
                  onClick={() => {
                    if (isDrawMode) {
                      if (window.confirm('Bạn đang vẽ ranh giới chưa lưu. Hủy bản vẽ hiện tại?')) {
                        setIsDrawMode(false);
                        setDrawVertices([]);
                      } else {
                        return;
                      }
                    }
                    setSelectedDistrictName(isSelected ? null : d.name);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-blue-50 border-blue-400 shadow-sm ring-1 ring-blue-400'
                      : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-gray-800">{d.district_name}</h4>
                      {d.administrative_code && (
                        <p className="text-xs text-gray-500 mt-1">
                          🔖 Mã ĐVHC: {d.administrative_code}
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
            Thêm Quận / Huyện
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

          {/* Render Existing Polygons */}
          {filteredDistricts.map(d => {
            const poly = parsedPolygons[d.name];
            if (!poly) return null;

            const isSelected = selectedDistrictName === d.name;
            return (
              <Polygon
                key={d.name}
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
                    setSelectedDistrictName(isSelected ? null : d.name);
                  }
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{d.district_name}</strong>
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
        {selectedDistrictName && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur shadow-lg border border-gray-200 p-4 rounded-xl max-w-sm z-[1000] flex flex-col gap-2 transition-all duration-300">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
              📍 {districts.find(d => d.name === selectedDistrictName)?.district_name}
            </h3>

            {!isDrawMode ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  size="small"
                  appearance="primary"
                  icon={<Edit20Regular />}
                  onClick={() => {
                    setDrawVertices(parsedPolygons[selectedDistrictName] || []);
                    setIsDrawMode(true);
                  }}
                >
                  {parsedPolygons[selectedDistrictName] ? 'Sửa ranh giới' : 'Vẽ ranh giới'}
                </Button>
                {parsedPolygons[selectedDistrictName] && (
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
                    const d = districts.find(x => x.name === selectedDistrictName);
                    if (d) {
                      setEditDistrict({ name: d.name, district_name: d.district_name, administrative_code: d.administrative_code || '' });
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
                    const d = districts.find(x => x.name === selectedDistrictName);
                    if (d) {
                      setDeletingDistrict({ name: d.name, district_name: d.district_name });
                      setDeleteReason('');
                      setIsDeleteOpen(true);
                    }
                  }}
                >
                  Xóa Quận
                </Button>
                <Button
                  size="small"
                  appearance="outline"
                  onClick={() => setSelectedDistrictName(null)}
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
            <DialogTitle>Thêm Quận/Huyện mới</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên Quận/Huyện (Ví dụ: Quận Hải Châu)">
                <Input
                  value={newDistrict.district_name}
                  onChange={e => setNewDistrict({ ...newDistrict, district_name: e.target.value })}
                  placeholder="Nhập tên quận/huyện..."
                />
              </Field>
              <Field label="Mã đơn vị hành chính (Tùy chọn)">
                <Input
                  value={newDistrict.administrative_code}
                  onChange={e => setNewDistrict({ ...newDistrict, administrative_code: e.target.value })}
                  placeholder="Ví dụ: 04"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsAddOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleAddDistrict}>
                Tạo quận/huyện
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(_, d) => setIsEditOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Sửa thông tin Quận/Huyện</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Tên Quận/Huyện (Ví dụ: Quận Hải Châu)">
                <Input
                  value={editDistrict.district_name}
                  onChange={e => setEditDistrict({ ...editDistrict, district_name: e.target.value })}
                  placeholder="Nhập tên quận/huyện..."
                />
              </Field>
              <Field label="Mã đơn vị hành chính (Tùy chọn)">
                <Input
                  value={editDistrict.administrative_code}
                  onChange={e => setEditDistrict({ ...editDistrict, administrative_code: e.target.value })}
                  placeholder="Ví dụ: 04"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsEditOpen(false)}>
                Hủy
              </Button>
              <Button appearance="primary" onClick={handleEditDistrict}>
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
            <DialogTitle className="text-red-600">Xóa Quận/Huyện</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">Bạn có chắc chắn muốn xóa Quận/Huyện này không? Hành động này không thể hoàn tác.</p>
                <p className="font-bold">{deletingDistrict?.district_name}</p>
              </div>
              <Field label="Lý do xóa (Bắt buộc)">
                <textarea 
                   className="w-full border border-gray-300 rounded p-2 text-sm" 
                   rows={3} 
                   placeholder="Nhập lý do tại sao xóa quận/huyện này..."
                   value={deleteReason}
                   onChange={e => setDeleteReason(e.target.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteOpen(false)} disabled={isDeleting}>Hủy</Button>
              <Button appearance="primary" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={handleDeleteDistrict} disabled={isDeleting || !deleteReason.trim()}>
                {isDeleting ? <Spinner size="tiny" /> : "Xác nhận Xóa"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
