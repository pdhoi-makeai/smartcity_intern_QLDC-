import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Title1, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell, Spinner, Button, Input, Field, TabList, Tab, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions
} from '@fluentui/react-components';

interface DeletionLog {
  name: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  reason: string;
  deleted_by: string;
  deleted_at: string;
  deleted_data: string;
}

export default function DeletionHistory() {
  const [logs, setLogs] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Cư dân');
  
  const [selectedLog, setSelectedLog] = useState<DeletionLog | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRestoreOpen, setIsRestoreOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/method/frappe.client.get_list', {
        params: {
          doctype: 'Deletion History',
          fields: '["name","entity_type","entity_id","entity_name","reason","deleted_by","deleted_at","deleted_data"]',
          limit_page_length: 500,
          order_by: 'creation desc'
        }
      });
      setLogs(res.data.message || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRestore = async () => {
    if (!selectedLog || !selectedLog.deleted_data) return;
    setIsRestoring(true);
    try {
      const data = JSON.parse(selectedLog.deleted_data);
      // Remove Frappe standard tracking fields to let Frappe assign a new name or re-insert cleanly
      delete data.name;
      delete data.creation;
      delete data.modified;
      delete data.owner;
      delete data.modified_by;
      
      let doctype = '';
      if (selectedLog.entity_type === 'Cư dân') doctype = 'Resident';
      else if (selectedLog.entity_type === 'Hộ gia đình') doctype = 'Household';
      else if (selectedLog.entity_type === 'Tổ dân phố') doctype = 'Neighborhood';
      else if (selectedLog.entity_type === 'Phường/Xã') doctype = 'Ward';
      else if (selectedLog.entity_type === 'Quận/Huyện') doctype = 'District';
      
      data.doctype = doctype;

      // Create new entity
      await api.post('/api/method/frappe.client.insert', { doc: data });

      // Delete the log
      await api.post('/api/method/frappe.client.delete', {
        doctype: 'Deletion History',
        name: selectedLog.name
      });

      alert(`Đã khôi phục ${selectedLog.entity_type} thành công!`);
      setIsRestoreOpen(false);
      fetchLogs();
    } catch (e: any) {
      alert("Lỗi khi khôi phục: " + (e.response?.data?.message || e.message));
    } finally {
      setIsRestoring(false);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.entity_type === activeTab &&
    (
      (l.entity_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.reason || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_id || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <Title1>Lịch sử Xóa Dữ liệu</Title1>
        <Button appearance="secondary" onClick={fetchLogs}>Tải lại</Button>
      </div>

      <div className="bg-white p-4 shadow-sm rounded-lg border border-gray-200 mb-4">
        <TabList selectedValue={activeTab} onTabSelect={(e, d) => setActiveTab(d.value as string)} className="mb-4">
          <Tab value="Cư dân">Cư dân</Tab>
          <Tab value="Hộ gia đình">Hộ gia đình</Tab>
          <Tab value="Quận/Huyện">Quận/Huyện</Tab>
          <Tab value="Phường/Xã">Phường/Xã</Tab>
          <Tab value="Tổ dân phố">Tổ dân phố</Tab>
        </TabList>
        <div className="flex gap-4">
          <Field label="Tìm kiếm">
             <Input placeholder="Tìm theo mã, tên, lý do..." value={search} onChange={e => setSearch(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="bg-white p-4 shadow rounded-lg border overflow-x-auto">
        <div className="mb-2 text-sm text-gray-500">Hiển thị {filteredLogs.length.toLocaleString()} bản ghi</div>
        
        {loading ? (
          <div className="p-8 flex justify-center"><Spinner label="Đang tải dữ liệu..." /></div>
        ) : (
          <Table size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Thời gian</TableHeaderCell>
                <TableHeaderCell>Mã ID (Cũ)</TableHeaderCell>
                <TableHeaderCell>Tên / Thông tin</TableHeaderCell>
                <TableHeaderCell>Lý do xóa</TableHeaderCell>
                <TableHeaderCell>Người xóa</TableHeaderCell>
                <TableHeaderCell>Hành động</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map(log => (
                <TableRow key={log.name}>
                  <TableCell className="text-gray-600 text-xs">{log.deleted_at}</TableCell>
                  <TableCell className="font-mono text-gray-500">{log.entity_id}</TableCell>
                  <TableCell className="font-medium">{log.entity_name}</TableCell>
                  <TableCell className="text-red-700 font-medium max-w-xs truncate" title={log.reason}>{log.reason}</TableCell>
                  <TableCell className="text-gray-500">{log.deleted_by}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                       <Button size="small" appearance="subtle" onClick={() => { setSelectedLog(log); setIsDetailOpen(true); }}>Chi tiết</Button>
                       {log.deleted_data && (
                         <Button size="small" appearance="outline" onClick={() => { setSelectedLog(log); setIsRestoreOpen(true); }}>Khôi phục</Button>
                       )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center p-8 text-gray-500">Không có dữ liệu</TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={(e, d) => setIsDetailOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Chi tiết Lịch sử Xóa</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              {selectedLog && (
                <>
                  <div><strong>Mã (cũ):</strong> {selectedLog.entity_id}</div>
                  <div><strong>Thông tin:</strong> {selectedLog.entity_name}</div>
                  <div><strong>Người xóa:</strong> {selectedLog.deleted_by} ({selectedLog.deleted_at})</div>
                  <div className="p-3 bg-red-50 text-red-800 rounded border border-red-200">
                    <strong>Lý do xóa:</strong><br/>
                    {selectedLog.reason}
                  </div>
                  {selectedLog.deleted_data && (
                    <div className="mt-4">
                      <strong>Dữ liệu JSON đã sao lưu:</strong>
                      <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-x-auto max-h-48 border">
                        {JSON.stringify(JSON.parse(selectedLog.deleted_data), null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="primary" onClick={() => setIsDetailOpen(false)}>Đóng</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Restore Modal */}
      <Dialog open={isRestoreOpen} onOpenChange={(e, d) => setIsRestoreOpen(d.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle className="text-blue-600">Khôi phục Dữ liệu</DialogTitle>
            <DialogContent className="pt-4 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">Bạn có chắc chắn muốn khôi phục bản ghi này không? Mã ID mới sẽ được tạo tự động.</p>
                <p className="font-bold">{selectedLog?.entity_name}</p>
                <p className="text-xs text-gray-600 mt-1">Loại: {selectedLog?.entity_type}</p>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setIsRestoreOpen(false)} disabled={isRestoring}>Hủy</Button>
              <Button appearance="primary" onClick={handleRestore} disabled={isRestoring}>
                {isRestoring ? <Spinner size="tiny" /> : "Xác nhận Khôi phục"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

    </div>
  );
}
