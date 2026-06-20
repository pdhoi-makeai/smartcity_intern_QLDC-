import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  TableBody, TableCell, TableRow, Table, TableHeader, TableHeaderCell,
  Button, Input, Title1, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Field, Select, Spinner
} from '@fluentui/react-components';

interface ResidentData { name: string; full_name: string; cccd: string; gender: string; dob: string; age: number; residency_status: string; household: string; social_welfare_status?: string; }
interface HouseholdData { name: string; head_name: string; address: string; neighborhood: string; }
interface WardData { name: string; ward_name: string; district: string; }
interface DistrictData { name: string; district_name: string; city: string; }

export default function ResidentList() {
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [households, setHouseholds] = useState<HouseholdData[]>([]);
  
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [wardNeighborhoods, setWardNeighborhoods] = useState<Record<string, string[]>>({});
  const [neighborhoodNamesMap, setNeighborhoodNamesMap] = useState<Record<string, string>>({});
  
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({ full_name: '', cccd: '', household: '', gender: 'Nam', residency_status: 'Thường trú' });

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Delete State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingResident, setDeletingResident] = useState<ResidentData | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [resDistricts, resWards, resNb, resHouseholds, resResidents] = await Promise.all([
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'District', fields: '["name","district_name","city"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Ward', fields: '["name","ward_name","district"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Neighborhood', fields: '["name","neighborhood_name","ward"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Household', fields: '["name","head_name","address","neighborhood"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Resident', fields: '["name","full_name","cccd","gender","dob","age","residency_status","household","social_welfare_status"]', limit_page_length: 0 } })
        ]);

        setDistricts(resDistricts.data.message || []);
        setWards(resWards.data.message || []);
        setHouseholds(resHouseholds.data.message || []);
        setResidents(resResidents.data.message || []);

        const nbMap: Record<string, string[]> = {};
        const nameMap: Record<string, string> = {};
        (resNb.data.message || []).forEach((n: any) => {
          if (!nbMap[n.ward]) nbMap[n.ward] = [];
          nbMap[n.ward].push(n.name);
          nameMap[n.name] = n.neighborhood_name;
        });
        setWardNeighborhoods(nbMap);
        setNeighborhoodNamesMap(nameMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSave = () => {
    if (isEditMode) {
      api.post('/api/method/frappe.client.set_value', {
        doctype: 'Resident',
        name: formData.name,
        fieldname: {
          full_name: formData.full_name,
          cccd: formData.cccd,
          household: formData.household,
          residency_status: formData.residency_status
        }
      }).then(() => {
        setIsOpen(false);
        window.location.reload();
      }).catch(e => alert('Lỗi: ' + e.message));
    } else {
      api.post('/api/method/frappe.client.insert', { doc: { doctype: 'Resident', ...formData } })
      .then(() => {
        setIsOpen(false);
        window.location.reload();
      }).catch(e => alert('Lỗi: ' + e.message));
    }
  };

  const handleEdit = (r: ResidentData) => {
    setFormData({ ...r });
    setIsEditMode(true);
    setIsOpen(true);
  };

  const openDeleteModal = (r: ResidentData) => {
    setDeletingResident(r);
    setDeleteReason('');
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteResident = async () => {
    if (!deleteReason.trim()) return alert("Vui lòng nhập lý do xóa");
    if (!deletingResident) return;
    
    setIsDeleting(true);
    try {
      // 1. Create Deletion History log
      await api.post('/api/method/frappe.client.insert', {
        doc: {
          doctype: 'Deletion History',
          entity_type: 'Cư dân',
          entity_id: deletingResident.name,
          entity_name: `Tên: ${deletingResident.full_name} - CCCD: ${deletingResident.cccd}`,
          reason: deleteReason,
          deleted_by: 'Administrator',
          deleted_at: new Date().toISOString().replace('T', ' ').split('.')[0],
          deleted_data: JSON.stringify(deletingResident)
        }
      });
      
      // 2. Delete Resident document
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'Resident',
        name: deletingResident.name
      });
      
      alert("Xóa Cư dân thành công!");
      setIsDeleteDialogOpen(false);
      setDeleteReason('');
      setDeletingResident(null);
      
      // Reload Data
      setLoading(true);
      const res = await api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Resident', fields: '["name","full_name","cccd","gender","dob","age","residency_status","household","social_welfare_status"]', limit_page_length: 0 } });
      setResidents(res.data.message || []);
      setLoading(false);
    } catch (e: any) {
      alert("Lỗi khi xóa: " + (e.response?.data?.message || e.message || JSON.stringify(e)));
      setIsDeleting(false);
    }
  };

  // Maps for quick lookup
  const householdMap = useMemo(() => {
    const map = new Map<string, HouseholdData>();
    households.forEach(h => map.set(h.name, h));
    return map;
  }, [households]);

  const wardMap = useMemo(() => {
    const map = new Map<string, WardData>();
    wards.forEach(w => map.set(w.name, w));
    return map;
  }, [wards]);

  // Filtering
  const filteredResidents = useMemo(() => {
    let list = residents;

    // 1. Filter by Text
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.full_name && r.full_name.toLowerCase().includes(q)) || (r.cccd && r.cccd.includes(q)));
    }

    // 2. Filter by Geography
    if (selectedNeighborhood) {
      const validHouseholds = new Set(households.filter(h => h.neighborhood === selectedNeighborhood).map(h => h.name));
      list = list.filter(r => validHouseholds.has(r.household));
    } else if (selectedWard) {
      const allNB = new Set(wardNeighborhoods[selectedWard] || []);
      const validHouseholds = new Set(households.filter(h => allNB.has(h.neighborhood)).map(h => h.name));
      list = list.filter(r => validHouseholds.has(r.household));
    } else if (selectedDistrict) {
      const dWards = wards.filter(w => w.district === selectedDistrict).map(w => w.name);
      const allNB = new Set<string>();
      dWards.forEach(w => (wardNeighborhoods[w] || []).forEach(n => allNB.add(n)));
      const validHouseholds = new Set(households.filter(h => allNB.has(h.neighborhood)).map(h => h.name));
      list = list.filter(r => validHouseholds.has(r.household));
    }

    return list;
  }, [residents, households, wards, wardNeighborhoods, selectedDistrict, selectedWard, selectedNeighborhood, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredResidents.length / rowsPerPage);
  const paginatedResidents = filteredResidents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Formatting helpers
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const getFullAddress = (householdName: string) => {
    const h = householdMap.get(householdName);
    if (!h) return '';
    const wName = h.neighborhood; // Actually neighborhood is the name of the doc, which looks like "Tổ 12"
    let address = h.address || '';
    
    // Attempt to find Ward/District
    const ward = Object.keys(wardNeighborhoods).find(k => wardNeighborhoods[k].includes(h.neighborhood));
    if (ward) {
      const w = wardMap.get(ward);
      if (w) {
        address += `, ${w.ward_name}, ${w.district}`;
      }
    }
    return address;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Title1>Danh sách Cư dân</Title1>
        
        <Dialog open={isOpen} onOpenChange={(e, d) => { setIsOpen(d.open); if(!d.open) { setIsEditMode(false); setFormData({ full_name: '', cccd: '', household: '', gender: 'Nam', residency_status: 'Thường trú' }); } }}>
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="primary" onClick={() => { setIsEditMode(false); setFormData({ full_name: '', cccd: '', household: '', gender: 'Nam', residency_status: 'Thường trú' }); }}>Thêm mới Cư dân</Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>{isEditMode ? 'Chỉnh sửa Cư dân' : 'Thêm Cư dân mới'}</DialogTitle>
              <DialogContent className="space-y-4 pt-4">
                <Field label="Họ và tên"><Input value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} /></Field>
                <Field label="CCCD"><Input value={formData.cccd || ''} onChange={e => setFormData({...formData, cccd: e.target.value})} /></Field>
                <Field label="Mã Hộ gia đình"><Input value={formData.household || ''} onChange={e => setFormData({...formData, household: e.target.value})} /></Field>
                <Field label="Trạng thái cư trú">
                  <Select value={formData.residency_status || 'Thường trú'} onChange={e => setFormData({...formData, residency_status: e.target.value})}>
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Tạm vắng">Tạm vắng</option>
                  </Select>
                </Field>
              </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsOpen(false)}>Hủy</Button>
              <Button appearance="primary" onClick={handleSave}>Lưu thông tin</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      </div>
      {/* Filters */}
      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 mb-4 flex flex-wrap gap-4 items-end">
        <Field label="Tìm kiếm (Tên, CCCD)">
          <Input 
            placeholder="Nhập tên hoặc CCCD..." 
            value={searchQuery} 
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
          />
        </Field>

        <Field label="Quận/Huyện">
          <Select 
            value={selectedDistrict} 
            onChange={e => { setSelectedDistrict(e.target.value); setSelectedWard(''); setSelectedNeighborhood(''); setCurrentPage(1); }}
          >
            <option value="">Tất cả Quận/Huyện</option>
            {districts.map(d => <option key={d.name} value={d.name}>{d.district_name}</option>)}
          </Select>
        </Field>

        <Field label="Phường/Xã">
          <Select 
            value={selectedWard} 
            onChange={e => { setSelectedWard(e.target.value); setSelectedNeighborhood(''); setCurrentPage(1); }}
            disabled={!selectedDistrict}
          >
            <option value="">Tất cả Phường/Xã</option>
            {wards.filter(w => w.district === selectedDistrict).map(w => <option key={w.name} value={w.name}>{w.ward_name}</option>)}
          </Select>
        </Field>

        <Field label="Tổ dân phố">
          <Select 
            value={selectedNeighborhood} 
            onChange={e => { setSelectedNeighborhood(e.target.value); setCurrentPage(1); }}
            disabled={!selectedWard}
          >
            <option value="">Tất cả Tổ</option>
            {(wardNeighborhoods[selectedWard] || []).map(n => <option key={n} value={n}>{neighborhoodNamesMap[n] || n}</option>)}
          </Select>
        </Field>
      </div>

      <div className="bg-white p-4 shadow rounded-lg border overflow-x-auto">
        <div className="mb-2 text-sm text-gray-500">
          Hiển thị {filteredResidents.length.toLocaleString()} kết quả
        </div>

        {loading ? (
          <div className="p-8 flex justify-center"><Spinner label="Đang tải dữ liệu..." /></div>
        ) : (
          <>
            <Table size="small">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Họ và tên</TableHeaderCell>
                  <TableHeaderCell>Ngày sinh</TableHeaderCell>
                  <TableHeaderCell>Giới tính</TableHeaderCell>
                  <TableHeaderCell>CCCD</TableHeaderCell>
                  <TableHeaderCell>Hộ gia đình</TableHeaderCell>
                  <TableHeaderCell>Địa chỉ / Tổ dân phố</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Diện chính sách</TableHeaderCell>
                  <TableHeaderCell>Hành động</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResidents.map((r, i) => {
                  const household = householdMap.get(r.household);
                  const isSpecial = r.social_welfare_status && r.social_welfare_status !== 'Bình thường';
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{formatDate(r.dob)}</TableCell>
                      <TableCell>{r.gender}</TableCell>
                      <TableCell>{r.cccd}</TableCell>
                      <TableCell>
                        {household ? (
                          <div title={r.household}>
                            <span className="font-semibold text-blue-600">{household.head_name}</span>
                          </div>
                        ) : r.household}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600 max-w-xs truncate" title={getFullAddress(r.household)}>
                        <span className="font-semibold text-gray-800">{household && (neighborhoodNamesMap[household.neighborhood] || household.neighborhood)}</span><br/>
                        {getFullAddress(r.household)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${r.residency_status === 'Thường trú' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {r.residency_status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isSpecial && <span className="text-red-600 font-medium text-xs">{r.social_welfare_status}</span>}
                      </TableCell>
                      <TableCell>
                      <div className="flex gap-2">
                        <Button size="small" appearance="outline" onClick={() => handleEdit(r)}>Chỉnh sửa</Button>
                        <Button size="small" appearance="subtle" style={{ color: '#dc2626' }} onClick={() => openDeleteModal(r)}>Xóa</Button>
                      </div>
                    </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button 
                  disabled={currentPage === 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >Trang trước</Button>
                <span className="text-sm font-medium">Trang {currentPage} / {totalPages}</span>
                <Button 
                  disabled={currentPage === totalPages} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >Trang sau</Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(e, d) => setIsDeleteDialogOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle className="text-red-600">Xóa Cư dân</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 mb-2">Bạn có chắc chắn muốn xóa cư dân này không? Hành động này không thể hoàn tác.</p>
                <p className="font-bold">{deletingResident?.full_name} - {deletingResident?.cccd}</p>
                <p className="text-xs text-gray-600 mt-1">Hộ: {deletingResident?.household}</p>
              </div>
              <Field label="Lý do xóa (Bắt buộc)">
                <textarea 
                   className="w-full border border-gray-300 rounded p-2 text-sm" 
                   rows={3} 
                   placeholder="Nhập lý do tại sao xóa cư dân này..."
                   value={deleteReason}
                   onChange={e => setDeleteReason(e.target.value)}
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Hủy</Button>
              <Button appearance="primary" style={{ backgroundColor: '#dc2626', color: '#fff' }} onClick={handleDeleteResident} disabled={isDeleting || !deleteReason.trim()}>
                {isDeleting ? <Spinner size="tiny" /> : "Xác nhận Xóa"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
