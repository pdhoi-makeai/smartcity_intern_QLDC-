import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Button, Table, TableHeader, TableRow, TableHeaderCell, TableBody, TableCell,
  Spinner, ProgressBar, Badge, Title1
} from '@fluentui/react-components';
import {
  ArrowDownload20Regular, ArrowUpload20Regular, CheckmarkCircle20Regular,
  DismissCircle20Regular, Info20Regular
} from '@fluentui/react-icons';

interface PreviewRow {
  'Họ và tên': string;
  'Ngày sinh'?: string;
  'Giới tính'?: string;
  'Số căn cước'?: string;
  'Địa chỉ'?: string;
  'Phường/Xã'?: string;
  'Phường xã'?: string;
  'Tổ dân phố'?: string;
  [key: string]: string | undefined;
}

interface ImportLog {
  type: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export default function ImportData() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // CSV Data & File Name
  const [fileName, setFileName] = useState('');
  const [csvData, setCsvData] = useState<PreviewRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);

  // Import Process State
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [importSummary, setImportSummary] = useState({ residents: 0, households: 0, skipped: 0 });

  // Neighborhood Map for lookups
  const [neighborhoods, setNeighborhoods] = useState<{ name: string; neighborhood_name: string; ward: string }[]>([]);

  // Load Neighborhoods for verification
  useEffect(() => {
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'Neighborhood', fields: '["name","neighborhood_name","ward"]', limit_page_length: 0 }
    }).then(res => {
      setNeighborhoods(res.data.message || []);
    }).catch(err => {
      console.error('Error fetching neighborhoods:', err);
    });
  }, []);

  // Download Sample CSV
  const handleDownloadTemplate = () => {
    const csvContent = 
      "Họ và tên\tNgày sinh\tGiới tính\tSố căn cước\tĐịa chỉ\tPhường xã\tTổ dân phố\n" +
      "Nguyễn Văn An\t1980-01-15\tNam\t048080123456\t123 Ngô Quyền\tSơn Trà\tTổ dân phố 1 - Thọ Quang\n" +
      "Lê Thị Bình\t1983-05-20\tNữ\t048083987654\t123 Ngô Quyền\tSơn Trà\tTổ dân phố 1 - Thọ Quang\n" +
      "Nguyễn Văn Cường\t2010-09-12\tNam\t\t123 Ngô Quyền\tSơn Trà\tTổ dân phố 1 - Thọ Quang\n" +
      "Trần Văn Dũng\t1992-11-30\tNam\t048092111222\t456 Yết Kiêu\tSơn Trà\tTổ dân phố 2 - Thọ Quang\n";

    // Encode as UTF-16LE (2 bytes per char) with BOM (0xFEFF)
    const buffer = new ArrayBuffer(csvContent.length * 2 + 2);
    const view = new DataView(buffer);
    
    // Write UTF-16LE BOM (0xFEFF)
    view.setUint16(0, 0xFEFF, true);
    
    // Write characters
    for (let i = 0; i < csvContent.length; i++) {
      view.setUint16((i + 1) * 2, csvContent.charCodeAt(i), true);
    }

    const blob = new Blob([buffer], { type: 'text/csv;charset=utf-16le;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "mau_import_cu_dan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Parser
  const parseCSV = (text: string): PreviewRow[] => {
    // Strip UTF-8 BOM if present
    const cleanText = text.replace(/^\ufeff/, '');
    let lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    // Skip Excel sep directive line if present
    if (lines[0].startsWith('sep=')) {
      lines = lines.slice(1);
    }
    if (lines.length === 0) return [];

    // Auto-detect delimiter: count commas, semicolons, and tabs
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semiCount > commaCount && semiCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semiCount) {
      delimiter = '\t';
    }

    const regexPattern = delimiter === '\t' 
      ? /\t(?=(?:(?:[^"]*"){2})*[^"]*$)/ 
      : delimiter === ';' 
        ? /;(?=(?:(?:[^"]*"){2})*[^"]*$)/ 
        : /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    const headers = headerLine.split(regexPattern).map(h => h.replace(/^"|"$/g, '').trim());
    
    return lines.slice(1).map(line => {
      const parts = line.split(regexPattern).map(p => p.replace(/^"|"$/g, '').trim());
      const obj: PreviewRow = { 'Họ và tên': '' };
      headers.forEach((h, i) => {
        obj[h] = parts[i] || '';
      });
      return obj;
    });
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const decoder = new TextDecoder(); // Automatically handles BOM for UTF-8 and UTF-16LE
      const text = decoder.decode(arrayBuffer);
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setPreviewRows(parsed.slice(0, 10)); // Preview first 10 rows
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith('.csv')) {
      alert('Chỉ chấp nhận file CSV!');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const decoder = new TextDecoder();
      const text = decoder.decode(arrayBuffer);
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setPreviewRows(parsed.slice(0, 10));
    };
    reader.readAsArrayBuffer(file);
  };

  // Run the Import Logic
  const handleStartImport = async () => {
    if (csvData.length === 0) return;
    setStep(3);
    setImporting(true);
    setProgress(0);
    setImportLogs([]);
    setImportSummary({ residents: 0, households: 0, skipped: 0 });

    const addLog = (type: 'info' | 'success' | 'warn' | 'error', message: string) => {
      setImportLogs(prev => [...prev, { type, message }]);
    };

    addLog('info', `Bắt đầu phân tích và import danh sách ${csvData.length} bản ghi...`);

    // Fetch Ward database list to map correctly
    let systemWards: { name: string; ward_name: string; district: string }[] = [];
    try {
      const wardsRes = await api.get('/api/method/frappe.client.get_list', {
        params: { doctype: 'Ward', fields: '["name","ward_name","district"]', limit_page_length: 0 }
      });
      systemWards = wardsRes.data.message || [];
    } catch (err) {
      addLog('warn', 'Không thể kết nối danh sách Phường/Xã từ hệ thống. Việc ánh xạ có thể không chính xác.');
    }

    // Group rows by (Address + Ward + Neighborhood) to form Households
    const householdsGroup: Record<string, PreviewRow[]> = {};
    csvData.forEach(row => {
      const address = row['Địa chỉ']?.trim() || 'Chưa xác định';
      const ward = (row['Phường xã'] || row['Phường/Xã'] || '').trim() || 'Mặc định';
      const nb = row['Tổ dân phố']?.trim() || 'Mặc định';
      const key = `${address}:::${ward}:::${nb}`;
      if (!householdsGroup[key]) householdsGroup[key] = [];
      householdsGroup[key].push(row);
    });

    const groupKeys = Object.keys(householdsGroup);
    setTotalSteps(groupKeys.length);
    addLog('info', `Phát hiện ${groupKeys.length} hộ gia đình riêng biệt dựa trên địa chỉ.`);

    let residentCount = 0;
    let householdCount = 0;
    let skippedCount = 0;

    // Default Da Nang Center Coordinates
    const defaultLat = 16.047;
    const defaultLng = 108.206;

    for (let i = 0; i < groupKeys.length; i++) {
      const key = groupKeys[i];
      const [address, wardName, nbName] = key.split(':::');
      const members = householdsGroup[key];
      const headResident = members[0]; // first resident is the Head

      // Resolve ward
      let matchedWard = systemWards.find(
        w => w.ward_name.toLowerCase().includes(wardName.toLowerCase()) || 
             wardName.toLowerCase().includes(w.ward_name.toLowerCase())
      );

      // Find neighborhood link ID
      let neighborhoodId = '';
      let matchedNb = null;

      if (matchedWard) {
        matchedNb = neighborhoods.find(
          n => n.ward === matchedWard.name && 
               (n.neighborhood_name.toLowerCase().includes(nbName.toLowerCase()) || 
                nbName.toLowerCase().includes(n.neighborhood_name.toLowerCase()))
        );
      } else {
        // Try to match by district name if wardName matches a district (e.g. Sơn Trà)
        const wardsInDistrict = systemWards.filter(
          w => w.district.toLowerCase().includes(wardName.toLowerCase()) || 
               wardName.toLowerCase().includes(w.district.toLowerCase())
        );
        if (wardsInDistrict.length > 0) {
          const wardIds = wardsInDistrict.map(w => w.name);
          matchedNb = neighborhoods.find(
            n => wardIds.includes(n.ward) && 
                 (n.neighborhood_name.toLowerCase().includes(nbName.toLowerCase()) || 
                  nbName.toLowerCase().includes(n.neighborhood_name.toLowerCase()))
          );
        }
      }
      
      if (!matchedNb) {
        matchedNb = neighborhoods.find(
          n => n.neighborhood_name.toLowerCase().includes(nbName.toLowerCase()) || 
               nbName.toLowerCase().includes(n.neighborhood_name.toLowerCase())
        );
      }

      if (matchedNb) {
        neighborhoodId = matchedNb.name;
      } else {
        // Fallback to first neighborhood if not match
        if (neighborhoods.length > 0) {
          neighborhoodId = neighborhoods[0].name;
          addLog('warn', `Không tìm thấy tổ dân phố "${nbName}" thuộc phường "${wardName}". Gán tạm vào tổ "${neighborhoods[0].neighborhood_name}".`);
        } else {
          addLog('error', `Hệ thống chưa có Tổ dân phố nào được khai báo. Vui lòng tạo Tổ trước.`);
          setImporting(false);
          return;
        }
      }

      // Geocoding the address
      let lat = defaultLat;
      let lng = defaultLng;
      let hasCoords = false;

      try {
        const geocodeRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Đà Nẵng, Việt Nam')}`
        );
        const geocodeData = await geocodeRes.json();
        if (geocodeData && geocodeData.length > 0) {
          lat = parseFloat(geocodeData[0].lat);
          lng = parseFloat(geocodeData[0].lon);
          hasCoords = true;
        }
      } catch (err) {
        console.warn('Geocoding fail for address: ' + address, err);
      }

      let householdId = '';
      try {
        // Create Household
        const hhRes = await api.post('/api/method/frappe.client.insert', {
          doc: {
            doctype: 'Household',
            head_name: headResident['Họ và tên'],
            address: address,
            neighborhood: neighborhoodId,
            latitude: lat,
            longitude: lng,
            status: hasCoords ? 'Đã định vị' : 'Chưa định vị',
            household_type: 'Bình thường'
          }
        });
        householdId = hhRes.data.message.name;
        householdCount++;
        addLog('success', `Tạo hộ dân thành công: Chủ hộ ${headResident['Họ và tên']} tại ${address}.`);
      } catch (err: any) {
        addLog('error', `Lỗi khi tạo hộ gia đình tại ${address}: ${err.message || err}`);
        skippedCount += members.length;
        setProgress(i + 1);
        continue;
      }

      // Insert Residents for this Household
      for (const member of members) {
        const cccd = member['Số căn cước']?.trim();

        // Check duplicates if CCCD provided
        if (cccd) {
          try {
            const checkRes = await api.get('/api/method/frappe.client.get_list', {
              params: {
                doctype: 'Resident',
                filters: `[["cccd","=","${cccd}"]]`,
                fields: '["name"]'
              }
            });
            if (checkRes.data.message && checkRes.data.message.length > 0) {
              addLog('warn', `Cư dân ${member['Họ và tên']} có CCCD trùng lặp (${cccd}). Bỏ qua.`);
              skippedCount++;
              continue;
            }
          } catch (err) {
            console.error('Check duplicate error:', err);
          }
        }

        try {
          await api.post('/api/method/frappe.client.insert', {
            doc: {
              doctype: 'Resident',
              full_name: member['Họ và tên'],
              cccd: cccd || undefined,
              dob: member['Ngày sinh'] || undefined,
              gender: member['Giới tính'] === 'Nữ' ? 'Nữ' : 'Nam',
              household: householdId,
              residency_status: 'Thường trú'
            }
          });
          residentCount++;
        } catch (err: any) {
          addLog('error', `Lỗi khi thêm cư dân ${member['Họ và tên']}: ${err.message || err}`);
          skippedCount++;
        }
      }

      setProgress(i + 1);
      setImportSummary({ residents: residentCount, households: householdCount, skipped: skippedCount });
    }

    setImporting(false);
    addLog('success', `Hoàn tất quá trình import dữ liệu!`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen flex flex-col gap-6">
      {/* Header Breadcrumb */}
      <div className="flex flex-col gap-1">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>Quản trị</span> &gt; <span className="font-semibold text-blue-600">Import dữ liệu</span>
        </div>
        <Title1 className="text-2xl font-bold text-gray-800">Import dữ liệu hộ dân</Title1>
        <p className="text-xs text-gray-500 italic mt-0.5">Nhập danh sách cư dân từ file Excel / CSV</p>
      </div>

      {/* Stepper Header */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between px-12 select-none">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
            step === 1 ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100' : 'bg-green-100 text-green-700'
          }`}>
            {step > 1 ? '✓' : '1'}
          </div>
          <span className={`text-sm font-semibold ${step === 1 ? 'text-blue-600' : 'text-green-700'}`}>Chuẩn bị</span>
        </div>
        <div className="flex-1 h-[2px] bg-gray-200 mx-4" />
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
            step === 2 ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100' : step > 2 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {step > 2 ? '✓' : '2'}
          </div>
          <span className={`text-sm font-semibold ${step === 2 ? 'text-blue-600' : step > 2 ? 'text-green-700' : 'text-gray-400'}`}>Upload</span>
        </div>
        <div className="flex-1 h-[2px] bg-gray-200 mx-4" />
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
            step === 3 ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100' : 'bg-gray-100 text-gray-400'
          }`}>
            3
          </div>
          <span className={`text-sm font-semibold ${step === 3 ? 'text-blue-600' : 'text-gray-400'}`}>Kết quả</span>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 flex-1 flex flex-col gap-6">
        
        {/* Step 1: Prepare */}
        {step === 1 && (
          <div className="flex flex-col gap-6 flex-1">
            <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl flex justify-between items-center gap-4">
              <div className="flex items-start gap-3">
                <Info20Regular className="text-blue-600 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-blue-900 text-sm">Chuẩn bị file import</h3>
                  <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                    Tải file Excel mẫu, điền thông tin cư dân theo đúng cột quy định, sau đó upload lên hệ thống.
                    Cư dân có cùng địa chỉ sẽ được tự động nhóm thành một hộ dân.
                  </p>
                </div>
              </div>
              <Button
                appearance="primary"
                icon={<ArrowDownload20Regular />}
                onClick={handleDownloadTemplate}
                className="flex-shrink-0"
              >
                Tải file mẫu
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                📄 Mô tả các cột trong file mẫu
              </h4>
              <div className="overflow-x-auto border rounded-xl">
                <Table size="small">
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHeaderCell>Tên cột</TableHeaderCell>
                      <TableHeaderCell>Bắt buộc</TableHeaderCell>
                      <TableHeaderCell>Mô tả</TableHeaderCell>
                      <TableHeaderCell>Ví dụ</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Họ và tên</TableCell>
                      <TableCell><Badge color="danger" appearance="tint">Bắt buộc</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Họ tên đầy đủ của cư dân</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">Nguyễn Văn An</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Ngày sinh</TableCell>
                      <TableCell><Badge color="informative" appearance="tint">Tùy chọn</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Ngày/tháng/năm sinh hoặc chỉ năm</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">01/01/1980 hoặc 1980</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Giới tính</TableCell>
                      <TableCell><Badge color="informative" appearance="tint">Tùy chọn</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Chỉ nhận giá trị Nam hoặc Nữ</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">Nam</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Số căn cước</TableCell>
                      <TableCell><Badge color="informative" appearance="tint">Tùy chọn</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">12 chữ số CCCD/CMND</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">012345678901</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Địa chỉ</TableCell>
                      <TableCell><Badge color="warning" appearance="tint">Quan trọng</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Số nhà + tên đường đầy đủ. Cư dân cùng địa chỉ → 1 hộ dân.</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">123 Ngô Quyền</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Phường xã</TableCell>
                      <TableCell><Badge color="informative" appearance="tint">Tùy chọn</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Tên phường hoặc xã trực thuộc</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">Sơn Trà</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold text-gray-800 text-xs">Tổ dân phố</TableCell>
                      <TableCell><Badge color="informative" appearance="tint">Tùy chọn</Badge></TableCell>
                      <TableCell className="text-xs text-gray-600">Tên tổ dân phố chính xác trong hệ thống</TableCell>
                      <TableCell className="text-xs text-gray-400 italic">Tổ dân phố 1 - Thọ Quang</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t flex justify-end">
              <Button appearance="primary" onClick={() => setStep(2)}>
                Tiếp tục
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Upload & Preview */}
        {step === 2 && (
          <div className="flex flex-col gap-6 flex-1">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-300 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 bg-gray-50 hover:bg-blue-50/20 hover:border-blue-400 transition-all duration-300 relative cursor-pointer"
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <ArrowUpload20Regular className="text-gray-400 w-12 h-12" />
              <div className="text-center">
                <p className="font-bold text-sm text-gray-700">Kéo thả file CSV vào đây hoặc click để chọn file</p>
                <p className="text-xs text-gray-400 mt-1">Chấp nhận định dạng file .csv</p>
              </div>
              {fileName && (
                <Badge color="brand" className="mt-2 text-xs py-1 px-3">
                  📂 {fileName}
                </Badge>
              )}
            </div>

            {/* Preview Section */}
            {csvData.length > 0 && (
              <div className="flex flex-col gap-3 flex-1 min-h-[200px]">
                <h4 className="font-bold text-gray-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  👀 Xem trước dữ liệu ({csvData.length} dòng phân tích được)
                </h4>
                <div className="overflow-x-auto border rounded-xl flex-1 max-h-[300px]">
                  <Table size="small">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHeaderCell>Họ và tên</TableHeaderCell>
                        <TableHeaderCell>Ngày sinh</TableHeaderCell>
                        <TableHeaderCell>Giới tính</TableHeaderCell>
                        <TableHeaderCell>Số căn cước</TableHeaderCell>
                        <TableHeaderCell>Địa chỉ</TableHeaderCell>
                        <TableHeaderCell>Phường xã</TableHeaderCell>
                        <TableHeaderCell>Tổ dân phố</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-gray-800">{row['Họ và tên']}</TableCell>
                          <TableCell>{row['Ngày sinh']}</TableCell>
                          <TableCell>{row['Giới tính']}</TableCell>
                          <TableCell className="font-mono text-xs text-gray-500">{row['Số căn cước']}</TableCell>
                          <TableCell className="text-xs">{row['Địa chỉ']}</TableCell>
                          <TableCell className="text-xs">{row['Phường xã'] || row['Phường/Xã']}</TableCell>
                          <TableCell className="font-medium text-gray-700">{row['Tổ dân phố']}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {csvData.length > 10 && (
                  <p className="text-[11px] text-gray-400 italic">
                    * Chỉ hiển thị xem trước 10 dòng đầu tiên của file dữ liệu.
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto pt-6 border-t flex justify-between">
              <Button appearance="secondary" onClick={() => setStep(1)}>
                Quay lại
              </Button>
              <Button
                appearance="primary"
                disabled={csvData.length === 0}
                onClick={handleStartImport}
              >
                Bắt đầu import
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && (
          <div className="flex flex-col gap-6 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-gray-700">
                  {importing ? 'Đang thực hiện import dữ liệu...' : 'Đã hoàn tất quá trình import!'}
                </span>
                <span className="font-mono font-bold text-blue-600">
                  {progress} / {totalSteps} hộ dân
                </span>
              </div>
              <ProgressBar
                value={totalSteps > 0 ? progress / totalSteps : 0}
                color={importing ? 'brand' : 'success'}
              />
            </div>

            {/* Summary Box */}
            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border">
              <div className="text-center p-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Hộ gia đình đã tạo</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{importSummary.households}</p>
              </div>
              <div className="text-center p-2 border-x">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Cư dân đã thêm</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{importSummary.residents}</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Bản ghi bị bỏ qua/lỗi</p>
                <p className="text-2xl font-bold text-orange-500 mt-1">{importSummary.skipped}</p>
              </div>
            </div>

            {/* Console Log Output */}
            <div className="flex flex-col gap-2 flex-1">
              <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                🖥️ Nhật ký hệ thống (System Logs)
              </h4>
              <div className="bg-gray-950 text-gray-200 font-mono text-[11px] p-4 rounded-xl flex-1 max-h-[300px] overflow-y-auto space-y-1.5 border border-gray-800 shadow-inner">
                {importLogs.map((log, idx) => {
                  let color = 'text-gray-300';
                  let icon = <Info20Regular className="w-3.5 h-3.5 mt-0.5 text-blue-400" />;
                  if (log.type === 'success') {
                    color = 'text-green-400';
                    icon = <CheckmarkCircle20Regular className="w-3.5 h-3.5 mt-0.5 text-green-400" />;
                  } else if (log.type === 'warn') {
                    color = 'text-amber-400';
                    icon = <Info20Regular className="w-3.5 h-3.5 mt-0.5 text-amber-400" />;
                  } else if (log.type === 'error') {
                    color = 'text-red-400';
                    icon = <DismissCircle20Regular className="w-3.5 h-3.5 mt-0.5 text-red-400" />;
                  }

                  return (
                    <div key={idx} className={`flex items-start gap-2 ${color}`}>
                      {icon}
                      <span className="flex-1 leading-normal">{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto pt-6 border-t flex justify-end">
              <Button
                appearance="primary"
                disabled={importing}
                onClick={() => navigate('/')}
              >
                Hoàn tất & Về trang chủ
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
