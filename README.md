# Hệ Thống Quản Lý Dân Cư (Smart City)

Hệ thống Quản lý Dân cư là một giải pháp thuộc hệ sinh thái Thành phố thông minh (Smart City). Dự án được xây dựng với mục tiêu số hóa công tác quản lý nhân khẩu, hộ gia đình và thông tin địa lý của người dân.

## 🌟 Chức Năng Chính

- **Quản lý Cư dân & Hộ gia đình:** Cập nhật, thêm mới và tra cứu thông tin chi tiết của người dân (`ResidentList`) và các hộ gia đình (`HouseholdList`).
- **Trực quan hóa Bản đồ (GIS):** Hiển thị vị trí cư dân trên bản đồ số, hỗ trợ heatmap và marker cluster sử dụng Mapbox GL và Leaflet.
- **Thống kê & Báo cáo:** Dashboard thống kê dữ liệu dân cư (`DemographicsDashboard`) trực quan hóa bằng các biểu đồ (Recharts).
- **Quản lý Đơn vị Hành chính:** Phân cấp quản lý địa bàn từ Quận/Huyện đến Phường/Xã, Tổ dân phố.
- **Lịch sử & Biến động:** Theo dõi lịch sử thay đổi, xóa dữ liệu (`DeletionHistory`) và quản lý các sự kiện đời sống.

---

## 🛠 Tech Stack (Công Nghệ)

- **Backend:** Frappe Framework v16, Python, PostgreSQL, Redis. 
  - App chính: `quan_ly_dan_cu`
- **Frontend:** React 18, Vite, TypeScript, TailwindCSS v4, Microsoft Fluent UI.
  - Quản lý State/Data: Zustand, React Query.
  - Bản đồ: Leaflet, Mapbox-GL.

---

## 🚀 Hướng Dẫn Cài Đặt (Setup Guide)

### 1. Yêu cầu hệ thống (Prerequisites)
Để chạy dự án trên môi trường cục bộ (local), hệ thống của bạn cần cài đặt:
- **Node.js** (v18 trở lên) & npm
- **Python** (v3.10 trở lên)
- **PostgreSQL** & **Redis** (Cấu hình theo tiêu chuẩn của Frappe)

---

### 2. Cài Đặt Backend (Frappe v16)

Mã nguồn backend và môi trường Frappe được đặt tại thư mục `backend/v16-bench`. 

**Bước 1: Khởi động các dịch vụ phụ trợ**
Hãy chắc chắn rằng dịch vụ `postgresql` và `redis-server` đang hoạt động trên máy của bạn.

**Bước 2: Khởi động Backend**
Dự án đã được thiết lập sẵn trong thư mục bench. Bạn chỉ cần truy cập vào thư mục `backend/v16-bench` và khởi động (có thể sử dụng lệnh bench hoặc procfile tuỳ hệ thống):
```bash
cd backend/v16-bench
bench start
```
*Ghi chú:* 
- Hệ thống mặc định chạy API ở port **8001**.
- Cấu hình cơ sở dữ liệu (PostgreSQL) được đặt tại `sites/smartcity.localhost/site_config.json`. Nếu cần, bạn có thể kiểm tra và cập nhật `db_password` cho phù hợp với máy của bạn.

---

### 3. Cài Đặt Frontend (React + Vite)

Dự án frontend nằm hoàn toàn trong thư mục `frontend/`.

**Bước 1: Cài đặt các gói thư viện (NPM Packages)**
Mở một terminal mới, chuyển hướng vào thư mục frontend và tiến hành cài đặt:
```bash
cd frontend
npm install
```

**Bước 2: Cấu hình Backend Proxy**
Vite đã được cấu hình tự động proxy các request `/api` và `/method` sang `http://localhost:8001` (backend Frappe). 

**Bước 3: Khởi chạy môi trường phát triển (Dev Server)**
Chạy lệnh sau để khởi động frontend:
```bash
npm run dev
```
Dự án sẽ được build và tự động mở tại địa chỉ `http://localhost:5173/` trên trình duyệt.
