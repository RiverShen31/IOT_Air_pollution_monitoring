import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Token nằm trong cookie httpOnly do backend set (xem authController.js) — JS phía client
// không đọc/ghi được, browser tự đính kèm cookie vào mỗi request nhờ withCredentials: true.
// Giảm rủi ro bị đánh cắp qua XSS so với lưu trong localStorage trước đây.
export const api = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true });

let onAuthFailure = null;
export function setOnAuthFailure(fn) {
  onAuthFailure = fn;
}

// Access token cookie hết hạn sau 15' -> tự động gọi /auth/refresh (cookie refreshToken được
// gửi kèm tự động) để backend cấp lại cặp cookie mới, rồi retry request gốc.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthEndpoint = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true })
            .finally(() => {
              refreshPromise = null;
            });
        }
        await refreshPromise;
        return api(original);
      } catch (refreshErr) {
        onAuthFailure?.();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);
