import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  TableBody, TableCell, TableRow, Table, TableHeader, TableHeaderCell,
  Button, Input, Title1, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Field, Select, Spinner
} from '@fluentui/react-components';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

function LocationPicker({ lat, lng, setLat, setLng, bounds }: any) {
  const map = useMapEvents({
    click(e) {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
    }
  });

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [10, 10], maxZoom: 17 });
      } catch (e) { console.warn(e); }
    }
  }, [bounds, map]);

  return lat && lng ? <Marker position={[lat, lng]} /> : null;
}

interface HouseholdData { name: string; head_name: string; address: string; neighborhood: string; household_type?: string; }
interface ResidentData { name: string; full_name: string; cccd: string; gender: string; dob: string; age: number; residency_status: string; household: string; social_welfare_status?: string; life_status?: string; }
interface WardData { name: string; ward_name: string; district: string; }
interface DistrictData { name: string; district_name: string; city: string; }

export default function HouseholdList() {
  const navigate = useNavigate();
  const [households, setHouseholds] = useState<HouseholdData[]>([]);
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [wardNeighborhoods, setWardNeighborhoods] = useState<Record<string, string[]>>({});
  const [allNeighborhoods, setAllNeighborhoods] = useState<string[]>([]);
  
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  
  // Detail Modal State
  const [selectedHousehold, setSelectedHousehold] = useState<HouseholdData | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<ResidentData[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Add Member State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({ full_name: '', cccd: '', gender: 'Nam', dob: '', residency_status: 'Thường trú' });

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingHousehold, setDeletingHousehold] = useState<HouseholdData | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Global Split/Merge Modal State
  const [isGlobalActionOpen, setIsGlobalActionOpen] = useState(false);
  const [cccdSearch, setCccdSearch] = useState('');
  const [searchedResident, setSearchedResident] = useState<ResidentData | null>(null);
  const [searchedHousehold, setSearchedHousehold] = useState<HouseholdData | null>(null);
  const [globalActionMode, setGlobalActionMode] = useState<'split' | 'merge'>('split');
  const [globalTransferTarget, setGlobalTransferTarget] = useState('');
  const [globalNewAddress, setGlobalNewAddress] = useState('');
  
  const [globalActionError, setGlobalActionError] = useState('');
  const [globalActionSuccess, setGlobalActionSuccess] = useState('');
  const [isGlobalActionLoading, setIsGlobalActionLoading] = useState(false);
  
  const [globalNewDistrict, setGlobalNewDistrict] = useState('');
  const [globalNewWard, setGlobalNewWard] = useState('');
  const [globalNewNeighborhood, setGlobalNewNeighborhood] = useState('');
  const [globalNewLat, setGlobalNewLat] = useState<number | null>(null);
  const [globalNewLng, setGlobalNewLng] = useState<number | null>(null);
  const [globalNewMapBounds, setGlobalNewMapBounds] = useState<L.LatLngBounds | null>(null);
  
  const [neighborhoodNamesMap, setNeighborhoodNamesMap] = useState<Record<string, string>>({});

  // Bulk Move State
  const [selectedHouseholds, setSelectedHouseholds] = useState<string[]>([]);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [bulkMoveTarget, setBulkMoveTarget] = useState('');
  const [isBulkMoving, setIsBulkMoving] = useState(false);

  const handleBulkMove = async () => {
    if (!bulkMoveTarget) return alert('Vui lòng chọn Tổ dân phố đích!');
    setIsBulkMoving(true);
    try {
      for (let hhName of selectedHouseholds) {
        await api.post('/api/method/frappe.client.set_value', {
          doctype: 'Household',
          name: hhName,
          fieldname: 'neighborhood',
          value: bulkMoveTarget
        });
      }
      alert(`Đã chuyển thành công ${selectedHouseholds.length} hộ gia đình!`);
      setSelectedHouseholds([]);
      setIsBulkMoveOpen(false);
      fetchHouseholds();
    } catch (e: any) {
      alert("Lỗi khi chuyển hộ gia đình: " + (e.response?.data?.message || e.message));
    } finally {
      setIsBulkMoving(false);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fetchHouseholds = async () => {
    setLoading(true);
    try {
      const [resDistricts, resWards, resNb, resHouseholds] = await Promise.all([
        api.get('/api/method/frappe.client.get_list', { params: { doctype: 'District', fields: '["name","district_name","city"]', limit_page_length: 0 } }),
        api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Ward', fields: '["name","ward_name","district"]', limit_page_length: 0 } }),
        api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Neighborhood', fields: '["name","neighborhood_name","ward"]', limit_page_length: 0 } }),
        api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Household', fields: '["name","head_name","address","neighborhood","household_type"]', limit_page_length: 0 } })
      ]);

      setDistricts(resDistricts.data.message || []);
      setWards(resWards.data.message || []);
      setHouseholds(resHouseholds.data.message || []);

      const nbMap: Record<string, string[]> = {};
      const nbs: string[] = [];
      const nameMap: Record<string, string> = {};
      (resNb.data.message || []).forEach((n: any) => {
        if (!nbMap[n.ward]) nbMap[n.ward] = [];
        nbMap[n.ward].push(n.name);
        nbs.push(n.name);
        nameMap[n.name] = n.neighborhood_name;
      });
      setWardNeighborhoods(nbMap);
      setAllNeighborhoods(nbs);
      setNeighborhoodNamesMap(nameMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();
  }, []);

  useEffect(() => {
    if (globalActionMode !== 'split') return;

    let doctype = '';
    let name = '';
    if (globalNewNeighborhood) { doctype = 'Neighborhood'; name = globalNewNeighborhood; }
    else if (globalNewWard) { doctype = 'Ward'; name = globalNewWard; }
    else if (globalNewDistrict) { doctype = 'District'; name = globalNewDistrict; }

    if (doctype && name) {
      api.get('/api/method/frappe.client.get', { params: { doctype, name } })
      .then(res => {
         if (res.data.message && res.data.message.geojson_boundary) {
             try {
                 const geojson = JSON.parse(res.data.message.geojson_boundary);
                 const layer = L.geoJSON(geojson);
                 setGlobalNewMapBounds(layer.getBounds());
             } catch (e) { console.error('Failed to parse geojson', e); }
         }
      })
    }
  }, [globalNewNeighborhood, globalNewWard, globalNewDistrict, globalActionMode]);

  const openHouseholdDetail = async (h: HouseholdData) => {
    setSelectedHousehold(h);
    setHouseholdMembers([]);
    setIsDetailOpen(true);
    try {
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: { 
          doctype: 'Resident', 
          fields: '["name","full_name","cccd","gender","dob","age","residency_status","household","social_welfare_status","life_status"]',
          filters: `[["household","=","${h.name}"]]`,
          limit_page_length: 0 
        }
      });
      setHouseholdMembers(res.data.message || []);
    } catch (e) {
      console.error(e);
    }
  };

  const wardMap = useMemo(() => {
    const map = new Map<string, WardData>();
    wards.forEach(w => map.set(w.name, w));
    return map;
  }, [wards]);

  const filteredHouseholds = useMemo(() => {
    let list = households;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(h => h.name.toLowerCase().includes(q) || (h.head_name && h.head_name.toLowerCase().includes(q)));
    }
    if (selectedType) list = list.filter(h => h.household_type === selectedType);
    if (selectedNeighborhood) {
      list = list.filter(h => h.neighborhood === selectedNeighborhood);
    } else if (selectedWard) {
      const allNB = new Set(wardNeighborhoods[selectedWard] || []);
      list = list.filter(h => allNB.has(h.neighborhood));
    } else if (selectedDistrict) {
      const dWards = wards.filter(w => w.district === selectedDistrict).map(w => w.name);
      const allNB = new Set<string>();
      dWards.forEach(w => (wardNeighborhoods[w] || []).forEach(n => allNB.add(n)));
      list = list.filter(h => allNB.has(h.neighborhood));
    }
    return list;
  }, [households, wards, wardNeighborhoods, selectedDistrict, selectedWard, selectedNeighborhood, selectedType, searchQuery]);

  const totalPages = Math.ceil(filteredHouseholds.length / rowsPerPage);
  const paginatedHouseholds = filteredHouseholds.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const getFullAddress = (h: HouseholdData) => {
    let address = h.address || '';
    const ward = Object.keys(wardNeighborhoods).find(k => wardNeighborhoods[k].includes(h.neighborhood));
    if (ward) {
      const w = wardMap.get(ward);
      if (w) address += `, ${w.ward_name}, ${w.district}`;
    }
    return address;
  };

  const updateMemberStatus = async (memberName: string, field: string, value: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái thành "${value}"?`)) return;
    try {
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'Resident', name: memberName, fieldname: field, value: value
      });
      setHouseholdMembers(prev => prev.map(m => m.name === memberName ? { ...m, [field]: value } : m));
    } catch (e) {
      alert('Lỗi cập nhật: ' + e);
    }
  };

  const handleAddMember = async () => {
    if (!newMember.full_name) return alert("Vui lòng nhập tên!");
    try {
      await api.post('/api/method/frappe.client.insert', {
        doc: { doctype: 'Resident', household: selectedHousehold?.name, ...newMember }
      });
      alert("Khai sinh / Thêm thành viên thành công!");
      setIsAddMemberOpen(false);
      setNewMember({ full_name: '', cccd: '', gender: 'Nam', dob: '', residency_status: 'Thường trú' });
      if (selectedHousehold) openHouseholdDetail(selectedHousehold);
    } catch (e) {
      alert("Lỗi: " + e);
    }
  };

  // --- Global Split/Merge Logic ---
  const handleSearchResident = async () => {
    setGlobalActionError('');
    setGlobalActionSuccess('');
    if (!cccdSearch) return setGlobalActionError("Vui lòng nhập CCCD!");
    try {
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: { 
          doctype: 'Resident', 
          fields: '["name","full_name","cccd","dob","household"]',
          filters: `[["cccd","=","${cccdSearch}"]]`
        }
      });
      if (res.data.message && res.data.message.length > 0) {
        const resident = res.data.message[0];
        setSearchedResident(resident);
        
        // Find household details locally or fetch if needed
        const hh = households.find(h => h.name === resident.household);
        if (hh) {
          setSearchedHousehold(hh);
          setGlobalNewNeighborhood(hh.neighborhood); // Default for new household
        } else {
          setSearchedHousehold({ name: resident.household, head_name: 'Unknown', address: '', neighborhood: '' });
        }
      } else {
        setGlobalActionError("Không tìm thấy Cư dân nào mang CCCD này!");
        setSearchedResident(null);
        setSearchedHousehold(null);
      }
    } catch (e: any) {
      setGlobalActionError("Lỗi tìm kiếm: " + (e.message || ""));
    }
  };

  const handleGlobalTransfer = async () => {
    if (!searchedResident) return;
    setGlobalActionError('');
    setGlobalActionSuccess('');
    setIsGlobalActionLoading(true);

    try {
      let targetHouseholdId = globalTransferTarget;

      if (globalActionMode === 'split') {
        if (!globalNewAddress) { setGlobalActionError("Vui lòng nhập địa chỉ mới!"); setIsGlobalActionLoading(false); return; }
        if (!globalNewNeighborhood) { setGlobalActionError("Vui lòng chọn Tổ dân phố!"); setIsGlobalActionLoading(false); return; }
        if (!globalNewLat || !globalNewLng) { setGlobalActionError("Vui lòng click ghim tọa độ trên bản đồ!"); setIsGlobalActionLoading(false); return; }

        let lat = globalNewLat;
        let lng = globalNewLng;

        // Create new Household
        const res = await api.post('/api/method/frappe.client.insert', {
          doc: { 
            doctype: 'Household', 
            head_name: searchedResident.full_name, 
            address: globalNewAddress, 
            neighborhood: globalNewNeighborhood,
            latitude: lat,
            longitude: lng,
            status: 'Đã định vị',
            household_type: 'Bình thường'
          }
        });
        targetHouseholdId = res.data.message.name;
      } else {
        const destHousehold = globalTransferTarget.trim();
        if (!destHousehold) { setGlobalActionError("Vui lòng nhập mã hộ đích!"); setIsGlobalActionLoading(false); return; }
        
        // Validate
        const checkRes = await api.get('/api/method/frappe.client.get_list', {
          params: { doctype: 'Household', filters: `[["name","=","${destHousehold}"]]`, limit_page_length: 1 }
        });
        if (!checkRes.data.message || checkRes.data.message.length === 0) {
          setGlobalActionError(`Mã hộ đích "${destHousehold}" không tồn tại! Vui lòng kiểm tra lại.`); 
          setIsGlobalActionLoading(false); 
          return;
        }

        targetHouseholdId = destHousehold;
      }

      // Move resident
      await api.post('/api/method/frappe.client.set_value', {
        doctype: 'Resident', name: searchedResident.name, fieldname: 'household', value: targetHouseholdId
      });

      setGlobalActionSuccess("Thao tác thành công!");
      
      // Reset state
      setTimeout(() => {
          setIsGlobalActionOpen(false);
          setCccdSearch('');
          setSearchedResident(null);
          setSearchedHousehold(null);
          setGlobalNewAddress('');
          setGlobalTransferTarget('');
          setGlobalNewLat(null);
          setGlobalNewLng(null);
          setGlobalNewMapBounds(null);
          setGlobalActionSuccess('');
      }, 1500);

      fetchHouseholds(); // Reload to see changes
    } catch (e: any) {
      setGlobalActionError(e.response?.data?.message || e.message || JSON.stringify(e));
    } finally {
      setIsGlobalActionLoading(false);
    }
  };

  const openDeleteModal = (h: HouseholdData) => {
    setDeletingHousehold(h);
    setDeleteReason('');
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteHousehold = async () => {
    if (!deleteReason.trim()) return alert("Vui lòng nhập lý do xóa");
    if (!deletingHousehold) return;
    
    setIsDeleting(true);
    try {
      // 1. Create Deletion History log
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Deletion History',
          entity_type: 'Hộ gia đình',
          entity_id: deletingHousehold.name,
          entity_name: `Chủ hộ: ${deletingHousehold.head_name} - Đ/C: ${deletingHousehold.address}`,
          reason: deleteReason,
          deleted_by: 'Administrator',
          deleted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
          deleted_data: JSON.stringify(deletingHousehold)
        }
      });
      
      // 2. Delete Household document
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'Household',
        name: deletingHousehold.name
      });
      
      alert("Xóa Hộ gia đình thành công!");
      setIsDeleteDialogOpen(false);
      setDeleteReason('');
      setDeletingHousehold(null);
      
      // Close detail modal if it's the one being deleted
      if (selectedHousehold?.name === deletingHousehold.name) {
         setIsDetailOpen(false);
      }
      
      fetchHouseholds();
    } catch (e: any) {
      alert("Lỗi khi xóa: " + (e.response?.data?.message || e.message || JSON.stringify(e)));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Title1>Quản lý Hộ gia đình</Title1>
        <div className="flex gap-2">
          {selectedHouseholds.length > 0 && (
            <Button appearance="primary" style={{ backgroundColor: '#2563eb' }} onClick={() => setIsBulkMoveOpen(true)}>
              Chuyển {selectedHouseholds.length} Hộ
            </Button>
          )}
          <Button appearance="primary" onClick={() => setIsGlobalActionOpen(true)}>
            🔄 Tách / Nhập Hộ Khẩu (Độc lập)
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 shadow-sm rounded-xl border border-gray-200 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <Field label="Tìm kiếm (Chủ hộ, Mã hộ)">
          <Input className="w-full" placeholder="Nhập tên hoặc mã..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
        </Field>
        <Field label="Diện gia đình">
          <Select className="w-full" value={selectedType} onChange={e => { setSelectedType(e.target.value); setCurrentPage(1); }}>
            <option value="">Tất cả</option>
            <option value="Bình thường">Bình thường</option>
            <option value="Hộ nghèo">Hộ nghèo</option>
            <option value="Hộ cận nghèo">Hộ cận nghèo</option>
            <option value="Gia đình chính sách">Gia đình chính sách</option>
          </Select>
        </Field>
        <Field label="Quận/Huyện">
          <Select className="w-full" value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedWard(''); setSelectedNeighborhood(''); setCurrentPage(1); }}>
            <option value="">Tất cả Quận/Huyện</option>
            {districts.map(d => <option key={d.name} value={d.name}>{d.district_name}</option>)}
          </Select>
        </Field>
        <Field label="Phường/Xã">
          <Select className="w-full" value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedNeighborhood(''); setCurrentPage(1); }} disabled={!selectedDistrict}>
            <option value="">Tất cả Phường/Xã</option>
            {wards.filter(w => w.district === selectedDistrict).map(w => <option key={w.name} value={w.name}>{w.ward_name}</option>)}
          </Select>
        </Field>
        <Field label="Tổ dân phố">
          <Select className="w-full" value={selectedNeighborhood} onChange={e => { setSelectedNeighborhood(e.target.value); setCurrentPage(1); }} disabled={!selectedWard}>
            <option value="">Tất cả Tổ</option>
            {(wardNeighborhoods[selectedWard] || []).map(n => <option key={n} value={n}>{neighborhoodNamesMap[n] || n}</option>)}
          </Select>
        </Field>
      </div>

      <div className="bg-white p-4 shadow rounded-lg border overflow-x-auto">
        <div className="mb-2 text-sm text-gray-500">Hiển thị {filteredHouseholds.length.toLocaleString()} hộ gia đình</div>

        {loading ? (
          <div className="p-8 flex justify-center"><Spinner label="Đang tải dữ liệu..." /></div>
        ) : (
          <>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className="w-10">
                    <input 
                      type="checkbox" 
                      checked={paginatedHouseholds.length > 0 && paginatedHouseholds.every(h => selectedHouseholds.includes(h.name))}
                      onChange={e => {
                        if (e.target.checked) {
                          const currentIds = paginatedHouseholds.map(h => h.name);
                          setSelectedHouseholds(Array.from(new Set([...selectedHouseholds, ...currentIds])));
                        } else {
                          const currentIds = paginatedHouseholds.map(h => h.name);
                          setSelectedHouseholds(selectedHouseholds.filter(id => !currentIds.includes(id)));
                        }
                      }}
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Mã Hộ</TableHeaderCell>
                  <TableHeaderCell>Chủ Hộ</TableHeaderCell>
                  <TableHeaderCell>Địa chỉ</TableHeaderCell>
                  <TableHeaderCell>Tổ dân phố</TableHeaderCell>
                  <TableHeaderCell>Diện gia đình</TableHeaderCell>
                  <TableHeaderCell>Hành động</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHouseholds.map((h, i) => {
                  const isSpecial = h.household_type && h.household_type !== 'Bình thường';
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <input 
                          type="checkbox" 
                          checked={selectedHouseholds.includes(h.name)}
                          onChange={e => {
                            if (e.target.checked) setSelectedHouseholds(prev => [...prev, h.name]);
                            else setSelectedHouseholds(prev => prev.filter(n => n !== h.name));
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-gray-500">{h.name}</TableCell>
                      <TableCell className="font-bold text-blue-700">{h.head_name}</TableCell>
                      <TableCell className="text-xs truncate max-w-[200px]" title={getFullAddress(h)}>{getFullAddress(h)}</TableCell>
                      <TableCell className="font-medium text-gray-700">{neighborhoodNamesMap[h.neighborhood] || h.neighborhood}</TableCell>
                      <TableCell>
                        {isSpecial && <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700 font-semibold">{h.household_type}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="small" appearance="outline" onClick={() => openHouseholdDetail(h)}>Xem chi tiết</Button>
                          <Button size="small" appearance="subtle" onClick={() => navigate(`/map?household=${h.name}`)}>📍 Bản đồ</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Trang trước</Button>
                <span className="text-sm font-medium">Trang {currentPage} / {totalPages}</span>
                <Button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Trang sau</Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Household Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={(e, d) => setIsDetailOpen(d.open)}>
        <DialogSurface style={{ maxWidth: '900px' }}>
          <DialogBody>
            <DialogTitle>Chi tiết Hộ gia đình {selectedHousehold?.name}</DialogTitle>
            <DialogContent className="pt-4">
              <div className="flex justify-between items-start mb-6 bg-gray-50 p-4 rounded-lg border">
                <div>
                  <p className="text-sm text-gray-500">Chủ hộ</p>
                  <p className="text-xl font-bold text-blue-700">{selectedHousehold?.head_name}</p>
                  <p className="text-sm mt-2"><strong>Địa chỉ:</strong> {selectedHousehold && getFullAddress(selectedHousehold)}</p>
                  <p className="text-sm"><strong>Tổ:</strong> {selectedHousehold && (neighborhoodNamesMap[selectedHousehold.neighborhood] || selectedHousehold.neighborhood)}</p>
                </div>
                <div className="flex gap-2">
                  <Button appearance="secondary" onClick={() => { setIsDetailOpen(false); navigate(`/map?household=${selectedHousehold?.name}`); }}>📍 Xem trên Bản đồ</Button>
                  <Button appearance="primary" onClick={() => setIsAddMemberOpen(true)}>+ Khai sinh / Thêm</Button>
                  {selectedHousehold && (
                     <Button appearance="primary" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={() => openDeleteModal(selectedHousehold)}>🗑️ Xóa Hộ</Button>
                  )}
                </div>
              </div>

              <h3 className="font-bold mb-2">Danh sách thành viên ({householdMembers.length})</h3>
              <Table size="small">
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Họ tên</TableHeaderCell>
                    <TableHeaderCell>Ngày sinh</TableHeaderCell>
                    <TableHeaderCell>Giới tính</TableHeaderCell>
                    <TableHeaderCell>Trạng thái Cư trú</TableHeaderCell>
                    <TableHeaderCell>Hành động (Biến động)</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {householdMembers.map(m => {
                    const isDead = m.life_status === 'Đã qua đời';
                    const isAbsent = m.residency_status === 'Tạm vắng';
                    const isHead = m.full_name === selectedHousehold?.head_name;
                    return (
                      <TableRow key={m.name} className={isDead ? 'opacity-50' : ''}>
                        <TableCell>
                          <span className={`${isHead ? 'font-bold text-blue-700' : 'font-medium'} ${isDead ? 'line-through' : ''}`}>
                            {isHead && '⭐ '}{m.full_name}
                          </span>
                        </TableCell>
                        <TableCell>{m.dob}</TableCell>
                        <TableCell>{m.gender}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${isDead ? 'bg-gray-200' : isAbsent ? 'bg-yellow-100 text-yellow-800' : m.residency_status === 'Thường trú' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {isDead ? 'Đã qua đời' : m.residency_status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {!isDead && (
                            <div className="flex gap-2">
                              <select className="text-xs border rounded p-1" value="" onChange={e => {
                                if (e.target.value === 'dead') updateMemberStatus(m.name, 'life_status', 'Đã qua đời');
                                else if (e.target.value === 'absent') updateMemberStatus(m.name, 'residency_status', 'Tạm vắng');
                                else if (e.target.value === 'present') updateMemberStatus(m.name, 'residency_status', 'Thường trú');
                                else if (e.target.value === 'temp') updateMemberStatus(m.name, 'residency_status', 'Tạm trú');
                              }}>
                                <option value="">- Chọn -</option>
                                <option value="temp">ĐK Tạm trú</option>
                                <option value="absent">ĐK Tạm vắng</option>
                                <option value="present">ĐK Thường trú</option>
                                <option value="dead">Khai tử</option>
                              </select>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDetailOpen(false)}>Đóng</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Global Split/Merge Modal */}
      <Dialog open={isGlobalActionOpen} onOpenChange={(e, d) => setIsGlobalActionOpen(d.open)}>
        <DialogSurface style={{ maxWidth: '600px' }}>
          <DialogBody>
            <DialogTitle>Tách / Nhập Hộ Khẩu Bằng CCCD</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="flex gap-2">
                <Input className="flex-1" value={cccdSearch} onChange={e => setCccdSearch(e.target.value)} placeholder="Nhập số CCCD của Cư dân..." />
                <Button appearance="primary" onClick={handleSearchResident}>🔍 Tìm thông tin</Button>
              </div>

              {searchedResident && (
                <div className="bg-blue-50 p-4 rounded border border-blue-100">
                  <p className="font-bold text-lg mb-1">{searchedResident.full_name}</p>
                  <p className="text-sm">Ngày sinh: {searchedResident.dob}</p>
                  <p className="text-sm">Hộ hiện tại: <strong>{searchedHousehold?.name}</strong> - Chủ hộ: {searchedHousehold?.head_name}</p>
                </div>
              )}

              {searchedResident && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input type="radio" name="global_mode" checked={globalActionMode === 'split'} onChange={() => setGlobalActionMode('split')} />
                      Tách ra lập Hộ mới
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input type="radio" name="global_mode" checked={globalActionMode === 'merge'} onChange={() => setGlobalActionMode('merge')} />
                      Chuyển sang Hộ khác
                    </label>
                  </div>

                  {globalActionMode === 'merge' && (
                    <Field label="Nhập Mã Hộ gia đình đích (VD: H002)">
                      <Input value={globalTransferTarget} onChange={e => setGlobalTransferTarget(e.target.value)} />
                    </Field>
                  )}

                  {globalActionMode === 'split' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Quận/Huyện mới">
                          <Select value={globalNewDistrict} onChange={e => { setGlobalNewDistrict(e.target.value); setGlobalNewWard(''); setGlobalNewNeighborhood(''); }}>
                            <option value="">- Chọn -</option>
                            {districts.map(d => <option key={d.name} value={d.name}>{d.district_name}</option>)}
                          </Select>
                        </Field>
                        <Field label="Phường/Xã mới">
                          <Select value={globalNewWard} onChange={e => { setGlobalNewWard(e.target.value); setGlobalNewNeighborhood(''); }} disabled={!globalNewDistrict}>
                            <option value="">- Chọn -</option>
                            {wards.filter(w => w.district === globalNewDistrict).map(w => <option key={w.name} value={w.name}>{w.ward_name}</option>)}
                          </Select>
                        </Field>
                        <Field label="Tổ dân phố mới">
                          <Select value={globalNewNeighborhood} onChange={e => setGlobalNewNeighborhood(e.target.value)} disabled={!globalNewWard}>
                            <option value="">- Chọn Tổ -</option>
                            {(wardNeighborhoods[globalNewWard] || []).map(n => <option key={n} value={n}>{neighborhoodNamesMap[n] || n}</option>)}
                          </Select>
                        </Field>
                        <Field label="Địa chỉ nhà mới (Số nhà, tên đường)">
                          <Input value={globalNewAddress} onChange={e => setGlobalNewAddress(e.target.value)} placeholder="VD: 15 đường Trần Phú" />
                        </Field>
                      </div>
                      
                      <div className="mt-2">
                        <p className="font-medium text-sm mb-1">Ghim tọa độ (Click vào bản đồ <span className="text-red-500">*</span>)</p>
                        <div className="h-48 rounded border border-gray-300 overflow-hidden relative">
                          <MapContainer center={[16.0544, 108.2022]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <LocationPicker lat={globalNewLat} lng={globalNewLng} setLat={setGlobalNewLat} setLng={setGlobalNewLng} bounds={globalNewMapBounds} />
                          </MapContainer>
                        </div>
                        {globalNewLat ? (
                           <p className="text-xs text-green-700 mt-1 font-semibold">Đã ghim: {globalNewLat.toFixed(5)}, {globalNewLng?.toFixed(5)}</p>
                        ) : (
                           <p className="text-xs text-red-600 mt-1">Chưa ghim tọa độ. Hãy click lên bản đồ.</p>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 italic mt-2 bg-yellow-50 p-2 rounded border border-yellow-200">
                        Công dân {searchedResident.full_name} sẽ được chỉ định làm Chủ hộ của hộ mới.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {globalActionError && (
                 <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200 mt-2">
                    <strong className="font-bold">Lỗi: </strong> {globalActionError}
                 </div>
              )}
              {globalActionSuccess && (
                 <div className="bg-green-50 text-green-700 p-3 rounded text-sm border border-green-200 mt-2">
                    <strong className="font-bold">Thành công!</strong> {globalActionSuccess}
                 </div>
              )}

            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsGlobalActionOpen(false)} disabled={isGlobalActionLoading}>Hủy</Button>
              <Button appearance="primary" disabled={!searchedResident || isGlobalActionLoading} onClick={handleGlobalTransfer}>
                {isGlobalActionLoading ? <Spinner size="tiny" /> : (globalActionMode === 'split' ? 'Duyệt tách hộ' : 'Thực hiện chuyển')}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={isAddMemberOpen} onOpenChange={(e, d) => setIsAddMemberOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Khai sinh / Thêm thành viên</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <Field label="Họ và tên"><Input value={newMember.full_name} onChange={e => setNewMember({...newMember, full_name: e.target.value})} /></Field>
              <Field label="Ngày sinh (YYYY-MM-DD)"><Input type="date" value={newMember.dob} onChange={e => setNewMember({...newMember, dob: e.target.value})} /></Field>
              <Field label="Giới tính">
                <Select value={newMember.gender} onChange={e => setNewMember({...newMember, gender: e.target.value})}>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </Select>
              </Field>
              <Field label="Trạng thái">
                <Select value={newMember.residency_status} onChange={e => setNewMember({...newMember, residency_status: e.target.value})}>
                  <option value="Thường trú">Thường trú</option>
                  <option value="Tạm trú">Tạm trú</option>
                </Select>
              </Field>
              <Field label="CCCD (Nếu có)"><Input value={newMember.cccd} onChange={e => setNewMember({...newMember, cccd: e.target.value})} /></Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsAddMemberOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={handleAddMember}>Lưu thông tin</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(e, d) => setIsDeleteDialogOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle className="text-red-600">Xóa Hộ gia đình</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">Bạn có chắc chắn muốn xóa Hộ gia đình này không? Hành động này không thể hoàn tác.</p>
                <p className="font-bold">{deletingHousehold?.name} - {deletingHousehold?.head_name}</p>
                <p className="text-xs text-gray-600 mt-1">{deletingHousehold?.address}</p>
              </div>
              <Field label="Lý do xóa (Bắt buộc)">
                <textarea 
                   className="w-full border border-gray-300 rounded p-2 text-sm" 
                   rows={3} 
                   placeholder="Nhập lý do tại sao xóa hộ gia đình này..."
                   value={deleteReason}
                   onChange={e => setDeleteReason(e.target.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Hủy</Button>
              <Button appearance="primary" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={handleDeleteHousehold} disabled={isDeleting || !deleteReason.trim()}>
                {isDeleting ? <Spinner size="tiny" /> : "Xác nhận Xóa"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Bulk Move Modal */}
      <Dialog open={isBulkMoveOpen} onOpenChange={(e, d) => setIsBulkMoveOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Thuyên chuyển Hộ gia đình hàng loạt</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-bold mb-2">Bạn đang chọn thuyên chuyển {selectedHouseholds.length} hộ gia đình.</p>
                <p className="text-sm text-blue-800">Toàn bộ nhân khẩu (cư dân) trong các hộ này sẽ tự động được chuyển theo sang Tổ dân phố mới. Quá trình này không thể hoàn tác.</p>
              </div>
              <Field label="Chọn Tổ dân phố đích để chuyển đến">
                <Select value={bulkMoveTarget} onChange={e => setBulkMoveTarget(e.target.value)}>
                  <option value="">-- Chọn Tổ dân phố đích --</option>
                  {allNeighborhoods.map(n => (
                    <option key={n} value={n}>{neighborhoodNamesMap[n] || n}</option>
                  ))}
                </Select>
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsBulkMoveOpen(false)} disabled={isBulkMoving}>Hủy</Button>
              <Button appearance="primary" style={{ backgroundColor: '#2563eb', color: '#fff' }} onClick={handleBulkMove} disabled={isBulkMoving || !bulkMoveTarget}>
                {isBulkMoving ? <Spinner size="tiny" /> : "Xác nhận chuyển"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

    </div>
  );
}
