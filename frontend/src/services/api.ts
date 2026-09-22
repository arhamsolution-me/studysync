import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept 401s and try to refresh token (for protected requests only)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh attempts for auth routes to prevent loops
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });

        if (data.data?.accessToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${data.data.accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        delete api.defaults.headers.common['Authorization'];
        // Personal mode: no login redirects
      }
    }

    return Promise.reject(error);
  }
);

// Initialize stored token
const initialStoredToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
if (initialStoredToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialStoredToken}`;
}

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('auth_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('auth_token');
    delete api.defaults.headers.common['Authorization'];
  }
};

export const getAuthToken = (): string | null => {
  return typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
};

// ─── Auth API ─────────────────────────────────────────────────────────

export const authApi = {
  register: (data: { fullName: string; email: string; password: string }) =>
    api.post('/auth/register', data),

  verifyOtp: (data: { email: string; otpCode: string }) =>
    api.post('/auth/verify-otp', data),

  resendOtp: (data: { email: string }) =>
    api.post('/auth/resend-otp', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: { email: string; otpCode: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),

  logout: () => {
    setAuthToken(null);
    return api.post('/auth/logout');
  },

  me: () => api.get('/auth/me'),

  updateProfile: (data: any) =>
    api.patch('/auth/profile', data),

  completeOnboarding: (data: {
    university?: string;
    major?: string;
    semester?: string;
    plan?: string;
    aiProviderPreference?: string;
    activeByokProvider?: string;
  }) => api.post('/auth/onboarding/complete', data),

  refresh: () => api.post('/auth/refresh'),
};

// ─── BYOK API Keys API ────────────────────────────────────────────────

export const apiKeyApi = {
  testKey: (provider: string, key: string) =>
    api.post('/user/keys/test', { provider, key }),

  saveKey: (provider: string, key: string, setAsActive: boolean = true) =>
    api.post('/user/keys', { provider, key, setAsActive }),

  listKeys: () => api.get('/user/keys'),

  setPreference: (aiProviderPreference: 'system' | 'byok', activeByokProvider?: string) =>
    api.patch('/user/keys/preference', { aiProviderPreference, activeByokProvider }),

  deleteKey: (provider: string) =>
    api.delete(`/user/keys/${provider}`),
};

// ─── Tasks API ────────────────────────────────────────────────────────

export const tasksApi = {
  getAll: (filters?: Record<string, string>) =>
    api.get('/tasks', { params: filters }),

  getOne: (id: string) => api.get(`/tasks/${id}`),

  create: (data: any) => api.post('/tasks', data),

  update: (id: string, data: any) => api.patch(`/tasks/${id}`, data),

  delete: (id: string) => api.delete(`/tasks/${id}`),

  dashboard: () => api.get('/tasks/dashboard'),

  calendar: (start: string, end: string) =>
    api.get('/tasks/calendar', { params: { start, end } }),
};

// ─── Voice API ────────────────────────────────────────────────────────

export const voiceApi = {
  transcribe: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  capture: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    return api.post('/voice/capture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  textCommand: (text: string) => api.post('/voice/text-command', { text }),
};

// ─── Notifications API ────────────────────────────────────────────────

export const notificationsApi = {
  triggerDigest: () => api.post('/notifications/digest/trigger'),
  previewDigest: () => api.get('/notifications/digest/preview'),
  sendTestEmail: (email?: string) => api.post('/notifications/test-email', { email }),
};

// ─── Courses & FAISS RAG API ──────────────────────────────────────────

export const coursesApi = {
  getAll: () => api.get('/courses'),
  getFaissInfo: () => api.get('/courses/faiss/info'),
  create: (data: { name: string; colorTag?: string }) => api.post('/courses', data),
  delete: (courseId: string) => api.delete(`/courses/${courseId}`),
  addMaterial: (courseId: string, data: { title: string; content: string }) =>
    api.post(`/courses/${courseId}/materials`, data),
  askChat: (
    courseId: string,
    question: string,
    files?: File[] | File | null,
    think?: boolean
  ) => {
    const fileList: File[] = Array.isArray(files) ? files : files ? [files] : [];
    if (fileList.length > 0) {
      const formData = new FormData();
      formData.append('question', question);
      if (think !== undefined) {
        formData.append('think', String(think));
      }
      fileList.forEach((f) => {
        formData.append('files', f);
      });
      return api.post(`/courses/${courseId}/chat`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post(`/courses/${courseId}/chat`, { question, think: !!think });
  },
  getChatHistory: (courseId: string) =>
    api.get(`/courses/${courseId}/chat/history`),
  clearChatHistory: (courseId: string) =>
    api.delete(`/courses/${courseId}/chat/history`),
  getCourseTasks: (courseId: string) =>
    api.get(`/courses/${courseId}/tasks`),
  uploadMaterial: (courseId: string, files: File[] | File) => {
    const formData = new FormData();
    const fileList: File[] = Array.isArray(files) ? files : [files];
    fileList.forEach((f) => {
      formData.append('files', f);
    });
    return api.post(`/courses/${courseId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ─── WhatsApp Integration API ─────────────────────────────────────────

export const whatsappApi = {
  getStatus: () => api.get('/whatsapp/status'),
  connect: () => api.post('/whatsapp/connect'),
  disconnect: () => api.post('/whatsapp/disconnect'),
  sendTest: (phoneNumber?: string, message?: string) =>
    api.post('/whatsapp/send-test', { phoneNumber, message }),
};

export default api;
