import React, { useState, useEffect, useMemo } from 'react';
import { Spinner, Title1, Select, Field, Button, Switch } from '@fluentui/react-components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../services/api';

interface HouseholdData { name: string; neighborhood: string; household_type?: string; }
interface ResidentData { name: string; gender: string; age: number; residency_status: string; household: string; social_welfare_status?: string; life_status?: string; }
interface WardData { name: string; ward_name: string; district: string; }
interface DistrictData { name: string; district_name: string; }
interface NbData { name: string; neighborhood_name: string; ward: string; }

export default function DemographicsDashboard() {
  const [loading, setLoading] = useState(true);
  
  const [households, setHouseholds] = useState<HouseholdData[]>([]);
  const [residents, setResidents] = useState<ResidentData[]>([]);
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [wards, setWards] = useState<WardData[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<NbData[]>([]);

  // Filters
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  
  // Modes
  const [isComparisonMode, setIsComparisonMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resDist, resWard, resNb, resHh, resRes] = await Promise.all([
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'District', fields: '["name","district_name"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Ward', fields: '["name","ward_name","district"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Neighborhood', fields: '["name","neighborhood_name","ward"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Household', fields: '["name","neighborhood","household_type"]', limit_page_length: 0 } }),
          api.get('/api/method/frappe.client.get_list', { params: { doctype: 'Resident', fields: '["name","gender","age","residency_status","household","social_welfare_status","life_status"]', limit_page_length: 0 } })
        ]);
        
        setDistricts(resDist.data.message || []);
        setWards(resWard.data.message || []);
        setNeighborhoods(resNb.data.message || []);
        setHouseholds(resHh.data.message || []);
        setResidents(resRes.data.message || []);
      } catch (e) {
        console.error("Lỗi fetch dữ liệu dashboard:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter Logic
  const filteredData = useMemo(() => {
    let activeHouseholds = households;

    if (selectedNeighborhood) {
      activeHouseholds = activeHouseholds.filter(h => h.neighborhood === selectedNeighborhood);
    } else if (selectedWard) {
      const nbs = new Set(neighborhoods.filter(n => n.ward === selectedWard).map(n => n.name));
      activeHouseholds = activeHouseholds.filter(h => nbs.has(h.neighborhood));
    } else if (selectedDistrict) {
      const ws = new Set(wards.filter(w => w.district === selectedDistrict).map(w => w.name));
      const nbs = new Set(neighborhoods.filter(n => ws.has(n.ward)).map(n => n.name));
      activeHouseholds = activeHouseholds.filter(h => nbs.has(h.neighborhood));
    }

    const activeHhIds = new Set(activeHouseholds.map(h => h.name));
    
    // Only count residents who are alive
    const activeResidents = residents.filter(r => 
      activeHhIds.has(r.household) && r.life_status !== 'Đã qua đời'
    );

    return { activeHouseholds, activeResidents };
  }, [households, residents, neighborhoods, wards, selectedDistrict, selectedWard, selectedNeighborhood]);

  const { activeHouseholds, activeResidents } = filteredData;

  // Overview Stats
  const totalResidents = activeResidents.length;
  const totalHouseholds = activeHouseholds.length;
  const needSupport = activeResidents.filter(r => r.social_welfare_status && r.social_welfare_status !== 'Bình thường').length;

  // Chart 1: Population Pyramid Data (Nam vs Nữ)
  const pyramidData = useMemo(() => {
    const bins = [
      { name: '0-14', min: 0, max: 14, Nam: 0, Nữ: 0 },
      { name: '15-24', min: 15, max: 24, Nam: 0, Nữ: 0 },
      { name: '25-54', min: 25, max: 54, Nam: 0, Nữ: 0 },
      { name: '55-64', min: 55, max: 64, Nam: 0, Nữ: 0 },
      { name: '65+', min: 65, max: 999, Nam: 0, Nữ: 0 },
    ];
    
    activeResidents.forEach(r => {
      const b = bins.find(bin => r.age >= bin.min && r.age <= bin.max);
      if (b) {
        if (r.gender === 'Nam') b.Nam -= 1; // Negative for left side of pyramid
        else if (r.gender === 'Nữ') b.Nữ += 1;
      }
    });
    return bins;
  }, [activeResidents]);

  // Chart 2: Residency Status
  const pieData = useMemo(() => {
    let thuong = 0; let tam = 0; let vang = 0;
    activeResidents.forEach(r => {
      if (r.residency_status === 'Thường trú') thuong++;
      else if (r.residency_status === 'Tạm trú') tam++;
      else if (r.residency_status === 'Tạm vắng') vang++;
    });
    return [
      { name: 'Thường trú', value: thuong },
      { name: 'Tạm trú', value: tam },
      { name: 'Tạm vắng', value: vang }
    ].filter(d => d.value > 0);
  }, [activeResidents]);
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

  // Chart 3: Welfare Status (Social)
  const welfareData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeResidents.forEach(r => {
      if (r.social_welfare_status && r.social_welfare_status !== 'Bình thường') {
        counts[r.social_welfare_status] = (counts[r.social_welfare_status] || 0) + 1;
      }
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [activeResidents]);

  // Chart 4: Household Type
  const hhTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    activeHouseholds.forEach(h => {
      if (h.household_type && h.household_type !== 'Bình thường') {
        counts[h.household_type] = (counts[h.household_type] || 0) + 1;
      }
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [activeHouseholds]);

  // Comparison Logic
  const comparisonData = useMemo(() => {
    if (!isComparisonMode) return [];
    const stats: Record<string, { name: string, DanSo: number, HoGiaDinh: number }> = {};

    if (!selectedDistrict) {
      // Compare all Districts
      districts.forEach(d => stats[d.name] = { name: d.district_name, DanSo: 0, HoGiaDinh: 0 });
      // We need to map residents -> hh -> nb -> ward -> district
      activeResidents.forEach(r => {
        const hh = households.find(h => h.name === r.household);
        if (!hh) return;
        const nb = neighborhoods.find(n => n.name === hh.neighborhood);
        if (!nb) return;
        const w = wards.find(w => w.name === nb.ward);
        if (w && stats[w.district]) stats[w.district].DanSo++;
      });
      activeHouseholds.forEach(hh => {
        const nb = neighborhoods.find(n => n.name === hh.neighborhood);
        if (!nb) return;
        const w = wards.find(w => w.name === nb.ward);
        if (w && stats[w.district]) stats[w.district].HoGiaDinh++;
      });
    } else if (!selectedWard) {
      // Compare Wards in selected District
      wards.filter(w => w.district === selectedDistrict).forEach(w => stats[w.name] = { name: w.ward_name, DanSo: 0, HoGiaDinh: 0 });
      activeResidents.forEach(r => {
        const hh = households.find(h => h.name === r.household);
        if (!hh) return;
        const nb = neighborhoods.find(n => n.name === hh.neighborhood);
        if (nb && stats[nb.ward]) stats[nb.ward].DanSo++;
      });
      activeHouseholds.forEach(hh => {
        const nb = neighborhoods.find(n => n.name === hh.neighborhood);
        if (nb && stats[nb.ward]) stats[nb.ward].HoGiaDinh++;
      });
    } else {
      // Compare Neighborhoods in selected Ward
      neighborhoods.filter(n => n.ward === selectedWard).forEach(n => stats[n.name] = { name: n.neighborhood_name || n.name, DanSo: 0, HoGiaDinh: 0 });
      activeResidents.forEach(r => {
        const hh = households.find(h => h.name === r.household);
        if (hh && stats[hh.neighborhood]) stats[hh.neighborhood].DanSo++;
      });
      activeHouseholds.forEach(hh => {
        if (stats[hh.neighborhood]) stats[hh.neighborhood].HoGiaDinh++;
      });
    }

    return Object.values(stats);
  }, [isComparisonMode, selectedDistrict, selectedWard, districts, wards, neighborhoods, activeResidents, activeHouseholds, households]);


  if (loading) return <div className="p-8 flex justify-center"><Spinner label="Đang phân tích dữ liệu..." /></div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <Title1>Dashboard Phân tích</Title1>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700">Chế độ So sánh</span>
          <Switch checked={isComparisonMode} onChange={e => setIsComparisonMode(e.currentTarget.checked)} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
        <Field label="Quận/Huyện">
          <Select value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedWard(''); setSelectedNeighborhood(''); }}>
            <option value="">Tất cả Quận/Huyện</option>
            {districts.map(d => <option key={d.name} value={d.name}>{d.district_name}</option>)}
          </Select>
        </Field>
        <Field label="Phường/Xã">
          <Select value={selectedWard} onChange={e => { setSelectedWard(e.target.value); setSelectedNeighborhood(''); }} disabled={!selectedDistrict}>
            <option value="">Tất cả Phường/Xã</option>
            {wards.filter(w => w.district === selectedDistrict).map(w => <option key={w.name} value={w.name}>{w.ward_name}</option>)}
          </Select>
        </Field>
        <Field label="Tổ dân phố">
          <Select value={selectedNeighborhood} onChange={e => setSelectedNeighborhood(e.target.value)} disabled={!selectedWard}>
            <option value="">Tất cả Tổ</option>
            {(neighborhoods.filter(n => n.ward === selectedWard)).map(n => <option key={n.name} value={n.name}>{n.neighborhood_name || n.name}</option>)}
          </Select>
        </Field>
      </div>

      {!isComparisonMode ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">👥</div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tổng số cư dân</p>
                <p className="text-3xl font-bold">{totalResidents.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">🏠</div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Tổng số hộ gia đình</p>
                <p className="text-3xl font-bold">{totalHouseholds.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl">❤️</div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Cá nhân cần hỗ trợ</p>
                <p className="text-3xl font-bold">{needSupport.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-bold text-lg mb-4">Tháp dân số (Nam/Nữ theo độ tuổi)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pyramidData} layout="vertical" stackOffset="sign">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={v => Math.abs(v).toString()} />
                    <YAxis dataKey="name" type="category" width={50} />
                    <Tooltip formatter={(value) => Math.abs(Number(value))} />
                    <Legend />
                    <Bar dataKey="Nam" fill="#3b82f6" stackId="stack" />
                    <Bar dataKey="Nữ" fill="#ec4899" stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-bold text-lg mb-4">Trạng thái cư trú</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => { const p = (percent || 0) * 100; return `${name} ${p > 0 && p < 1 ? '<1' : p.toFixed(1)}%`; }} outerRadius={100} fill="#8884d8" dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-bold text-lg mb-4">Thống kê An sinh (Cá nhân)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={welfareData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#f59e0b" name="Số người" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h3 className="font-bold text-lg mb-4">Thống kê Diện gia đình đặc biệt</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hhTypeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ef4444" name="Số hộ" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-sm border h-[600px]">
          <h3 className="font-bold text-lg mb-2">So sánh Nhân khẩu học</h3>
          <p className="text-gray-500 mb-6">
            {!selectedDistrict ? 'Đang hiển thị so sánh giữa các Quận/Huyện trên toàn Thành phố.' :
             !selectedWard ? 'Đang hiển thị so sánh giữa các Phường/Xã trong Quận đã chọn.' :
             'Đang hiển thị so sánh giữa các Tổ dân phố trong Phường đã chọn.'}
          </p>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="DanSo" fill="#3b82f6" name="Dân số (Người)" />
              <Bar dataKey="HoGiaDinh" fill="#10b981" name="Hộ gia đình (Hộ)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
