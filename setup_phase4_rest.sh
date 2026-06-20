#!/bin/bash
set -e

cd /home/user/Smart_City_V2/frontend

# tailwind
npm install -D tailwindcss postcss autoprefixer

cat << 'EOF' > tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

cat << 'EOF' > src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

cat << 'EOF' > vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/method': 'http://localhost:8000'
    }
  }
})
EOF

mkdir -p src/services
cat << 'EOF' > src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
EOF

cat << 'EOF' > src/App.tsx
import { useEffect, useState } from 'react'
import api from './services/api'

function App() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/api/method/frappe.client.get_list', {
      params: { doctype: 'User' }
    })
    .then(res => setData(res.data.message))
    .catch(err => setError(err.message))
  }, [])

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-blue-600">Smart City Dashboard</h1>
      {error && <div className="text-red-500">Error: {error}</div>}
      {data ? (
        <ul>
          {data.map((user: any, i: number) => (
            <li key={i}>{user.name}</li>
          ))}
        </ul>
      ) : (
        <p>Loading users...</p>
      )}
    </div>
  )
}

export default App
EOF
