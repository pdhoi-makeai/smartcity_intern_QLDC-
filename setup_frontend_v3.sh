#!/bin/bash

cd /home/user/Smart_City_V2/frontend
mkdir -p src/layout src/pages src/components

cat << 'EOF' > src/layout/MainLayout.tsx
import React from 'react';
import { Link, Outlet } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r flex flex-col shadow-sm">
        <div className="p-4 border-b font-bold text-xl text-blue-600">
          Quản Lý Cư Dân
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="block p-2 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600">Tổng quan</Link>
          <Link to="/residents" className="block p-2 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600">Danh sách cư dân</Link>
          <Link to="/map" className="block p-2 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600">Bản đồ cư dân</Link>
          <Link to="/neighborhoods" className="block p-2 rounded hover:bg-blue-50 text-gray-700 hover:text-blue-600">Tổ dân phố</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
EOF

cat << 'EOF' > src/pages/Overview.tsx
export default function Overview() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Tổng quan hệ thống</h1>
      <p>Chào mừng đến với hệ thống Quản lý dân cư và tổ dân phố.</p>
    </div>
  );
}
EOF

cat << 'EOF' > src/pages/ResidentList.tsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import {
  TableBody, TableCell, TableRow, Table, TableHeader, TableHeaderCell,
  Button, Input, Title1, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogActions, DialogContent, Field, Select
} from '@fluentui/react-components';

export default function ResidentList() {
  const [residents, setResidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', cccd: '', phone: '', household: 'H001', gender: 'Nam', residency_status: 'Thường trú' });

  const fetchResidents = () => {
    setLoading(true);
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Resident', fields: '["name", "full_name", "cccd", "gender", "phone", "residency_status"]' }
    })
    .then(res => setResidents(res.data.message || []))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResidents();
  }, []);

  const handleSave = () => {
    api.post('/api/method/frappe.client.insert', { doc: { doctype: 'Resident', ...formData } })
    .then(() => {
      setIsOpen(false);
      fetchResidents();
    }).catch(e => alert('Lỗi: ' + e.message));
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Title1>Danh sách Cư dân</Title1>
        
        <Dialog open={isOpen} onOpenChange={(e, d) => setIsOpen(d.open)}>
          <DialogTrigger disableButtonEnhancement>
            <Button appearance="primary">Thêm mới Cư dân</Button>
          </DialogTrigger>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Thêm Cư dân mới</DialogTitle>
              <DialogContent className="space-y-4 pt-4">
                <Field label="Họ và tên"><Input value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} /></Field>
                <Field label="CCCD"><Input value={formData.cccd} onChange={e => setFormData({...formData, cccd: e.target.value})} /></Field>
                <Field label="Điện thoại"><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></Field>
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement><Button appearance="secondary">Hủy</Button></DialogTrigger>
                <Button appearance="primary" onClick={handleSave}>Lưu thông tin</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>
      </div>

      <div className="bg-white p-4 shadow rounded-lg border">
        {loading ? <p>Đang tải dữ liệu...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Họ và tên</TableHeaderCell>
                <TableHeaderCell>CCCD</TableHeaderCell>
                <TableHeaderCell>Giới tính</TableHeaderCell>
                <TableHeaderCell>Điện thoại</TableHeaderCell>
                <TableHeaderCell>Trạng thái</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {residents.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell>{r.cccd}</TableCell>
                  <TableCell>{r.gender}</TableCell>
                  <TableCell>{r.phone}</TableCell>
                  <TableCell>{r.residency_status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
EOF

cat << 'EOF' > src/pages/ResidentMap.tsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';

export default function ResidentMap() {
  const [households, setHouseholds] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Household', filters: '[["status", "=", "Đã định vị"]]', fields: '["name", "head_name", "address", "latitude", "longitude"]' }
    })
    .then(res => setHouseholds(res.data.message || []))
  }, []);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="p-4 bg-white border-b shadow-sm z-10">
        <h1 className="text-xl font-bold">Bản đồ Cư dân</h1>
        <p className="text-sm text-gray-500">Hiển thị các hộ gia đình đã được định vị</p>
      </div>
      <div className="flex-1 relative z-0">
        <MapContainer center={[10.762622, 106.660172]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {households.map((h, i) => (
            h.latitude && h.longitude && (
              <Marker key={i} position={[h.latitude, h.longitude]}>
                <Popup>
                  <strong>{h.head_name}</strong><br/>
                  {h.address}
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
EOF

cat << 'EOF' > src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import MainLayout from './layout/MainLayout';
import Overview from './pages/Overview';
import ResidentList from './pages/ResidentList';
import ResidentMap from './pages/ResidentMap';

function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Overview />} />
            <Route path="residents" element={<ResidentList />} />
            <Route path="map" element={<ResidentMap />} />
            <Route path="*" element={<div className="p-8">Tính năng đang phát triển</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FluentProvider>
  );
}

export default App;
EOF

echo "Tạo Frontend files thành công!"
