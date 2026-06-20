import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  // Bypass Phân quyền bằng cách dùng tài khoản Administrator (Như thiết kế của MVP)
  config.headers.Authorization = `token 353100c05cfd1c3:8b7c629a801134b`;
  return config;
});

export default api;
