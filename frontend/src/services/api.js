import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData)
};

export const scanAPI = {
  createScan:    (data)       => apiClient.post('/scans', data),
  getScans:      ()           => apiClient.get('/scans'),
  getScan:       (id)         => apiClient.get(`/scans/${id}`),
  getDashboard:  ()           => apiClient.get('/scans/dashboard'),
  compareScan:   (a, b)       => apiClient.get(`/scans/compare?a=${a}&b=${b}`),
  // SSE — returns a native EventSource, not an axios call
  getProgress:   (id)         => new EventSource(`${API_BASE_URL}/scans/${id}/progress`),
};

export const targetAPI = {
  getTargets:    ()           => apiClient.get('/targets'),
  createTarget:  (data)       => apiClient.post('/targets', data),
  updateTarget:  (id, data)   => apiClient.put(`/targets/${id}`, data),
  deleteTarget:  (id)         => apiClient.delete(`/targets/${id}`),
};

export const reportAPI = {
  getReports:     ()          => apiClient.get('/reports'),
  downloadReport: (scanId)    =>
    apiClient.get(`/reports/${scanId}/download`, { responseType: 'blob' }),
};

export default apiClient;
