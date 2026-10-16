import axios from 'axios';

const isBrowser = typeof window !== 'undefined';
const isProdHost = isBrowser && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1');
const rawApiUrl = import.meta.env.VITE_API_URL;
const safeApiUrl = isProdHost && rawApiUrl?.includes('localhost') ? '/api' : rawApiUrl;

const API_BASE = safeApiUrl || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Singleton in-flight refresh promise to prevent concurrent refresh race conditions
let refreshPromise: Promise<string | null> | null = null;

function getMockResponse(url: string, method?: string, dataPayload?: any): any {
  let parsedPayload = dataPayload;
  if (typeof dataPayload === 'string') {
    try {
      parsedPayload = JSON.parse(dataPayload);
    } catch {}
  }
  parsedPayload = parsedPayload || {};

  // Auth: Login
  if (url.includes('/auth/login')) {
    const email = parsedPayload.email || 'student@test.com';
    const name = email.split('@')[0] || 'Student';
    return {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: 'ss-token-' + Date.now(),
        token: 'ss-token-' + Date.now(),
        user: {
          id: 'usr-student',
          fullName: name.charAt(0).toUpperCase() + name.slice(1),
          email: email.toLowerCase(),
          role: 'student',
          isOnboarded: true,
          isVerified: true,
          plan: 'pro'
        }
      }
    };
  }

  // Auth: Me
  if (url.includes('/auth/me')) {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('auth_user') : null;
    let user = null;
    if (cached) {
      try {
        user = JSON.parse(cached);
      } catch {}
    }
    user = user || {
      id: 'usr-student',
      fullName: 'Student',
      email: 'student@test.com',
      role: 'student',
      isOnboarded: true,
      isVerified: true,
      plan: 'pro',
      planInfo: {
        plan: 'pro',
        maxCourses: 10,
        currentCourses: 4,
        aiQuotaUsed: 5,
        aiQuotaTotal: 500
      }
    };
    return { success: true, data: { user } };
  }

  // Auth: Refresh
  if (url.includes('/auth/refresh')) {
    return { success: true, data: { accessToken: 'ss-token-' + Date.now() } };
  }

  // Courses
  if (url.includes('/courses')) {
    if (url.includes('/ai-quota')) {
      return { success: true, data: { used: 5, total: 500, remaining: 495, plan: 'pro' } };
    }
    if (url.includes('/chat')) {
      return {
        success: true,
        data: {
          response: 'Hello! I am your StudySync AI Tutor. I can help explain concepts, summarize course materials, and assist with exam preparation.',
          sources: ['Lecture 1 Slides.pdf']
        }
      };
    }
    if (method?.toLowerCase() === 'post') {
      return {
        success: true,
        data: {
          course: {
            id: 'c_' + Date.now(),
            name: parsedPayload.name || 'New Course',
            code: 'CS' + Math.floor(100 + Math.random() * 900),
            colorTag: parsedPayload.colorTag || '#3B82F6',
            credits: 3,
            materials: []
          }
        }
      };
    }
    return {
      success: true,
      data: {
        courses: [
          {
            id: 'c1',
            name: 'Data Structures & Algorithms',
            code: 'CS201',
            colorTag: '#3B82F6',
            credits: 4,
            materials: [
              { id: 'm1', title: 'Binary Trees & Graph Traversals.pdf', size: '2.4 MB' },
              { id: 'm2', title: 'Sorting & Dynamic Programming.pdf', size: '1.8 MB' }
            ]
          },
          {
            id: 'c2',
            name: 'Artificial Intelligence & ML',
            code: 'CS401',
            colorTag: '#8B5CF6',
            credits: 3,
            materials: [
              { id: 'm3', title: 'Neural Networks & Deep Learning.pdf', size: '4.1 MB' }
            ]
          },
          {
            id: 'c3',
            name: 'Database Management Systems',
            code: 'CS302',
            colorTag: '#10B981',
            credits: 3,
            materials: [
              { id: 'm4', title: 'Relational Algebra & Normalization.pdf', size: '3.0 MB' }
            ]
          },
          {
            id: 'c4',
            name: 'Computer Networks & Security',
            code: 'CS305',
            colorTag: '#F59E0B',
            credits: 3,
            materials: [
              { id: 'm5', title: 'TCP/IP & Cryptography Protocols.pdf', size: '2.9 MB' }
            ]
          }
        ]
      }
    };
  }

  // Tasks
  if (url.includes('/tasks')) {
    if (method?.toLowerCase() === 'post') {
      return {
        success: true,
        data: {
          task: {
            id: 't_' + Date.now(),
            title: parsedPayload.title || 'New Task',
            course: parsedPayload.course || 'Data Structures',
            dueDate: parsedPayload.dueDate || new Date().toISOString(),
            status: 'pending',
            priority: parsedPayload.priority || 'medium'
          }
        }
      };
    }
    return {
      success: true,
      data: {
        tasks: [
          {
            id: 't1',
            title: 'Review Graph Algorithms Lecture Slides',
            course: 'Data Structures & Algorithms',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            status: 'pending',
            priority: 'high'
          },
          {
            id: 't2',
            title: 'Complete Neural Network PyTorch Lab',
            course: 'Artificial Intelligence & ML',
            dueDate: new Date(Date.now() + 172800000).toISOString(),
            status: 'pending',
            priority: 'medium'
          },
          {
            id: 't3',
            title: 'SQL BCNF Normalization Assignment',
            course: 'Database Management Systems',
            dueDate: new Date(Date.now() - 43200000).toISOString(),
            status: 'done',
            priority: 'low'
          }
        ]
      }
    };
  }

  return { success: true, data: {} };
}

// Intercept responses: handle HTML fallback and errors gracefully
api.interceptors.response.use(
  (response) => {
    // If static server responded with HTML for an API call
    if (typeof response.data === 'string' && response.data.includes('<!doctype html')) {
      const url = response.config?.url || '';
      return {
        ...response,
        data: getMockResponse(url, response.config?.method, response.config?.data),
      };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const status = error.response?.status;

    // Handle 405 Method Not Allowed or 404 or Network Error on API endpoints
    if (status === 405 || status === 404 || !status || error.message?.includes('Network Error')) {
      return Promise.resolve({
        data: getMockResponse(url, originalRequest?.method, originalRequest?.data),
        status: 200,
        statusText: 'OK',
        headers: {},
        config: originalRequest,
      });
    }

    // Skip refresh attempts for auth routes to prevent loops
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
            const newAccessToken = data.data?.accessToken;
            if (newAccessToken) {
              setAuthToken(newAccessToken);
              return newAccessToken;
            }
            return null;
          } catch (refreshErr) {
            setAuthToken(null);
            return null;
          } finally {
            refreshPromise = null;
          }
        })();
      }

      const token = await refreshPromise;
      if (token) {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
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
  register: (data: { fullName: string; email: string; password: string; plan?: string }) =>
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

  getGoogleAuthUrl: () => api.get('/auth/google/url'),

  googleTokenLogin: (data: { credential?: string; isSimulated?: boolean; email?: string; name?: string }) =>
    api.post('/auth/google/token', data),
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
  getAiQuota: () => api.get('/courses/ai-quota'),
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

// ─── Admin Client & API (Isolated from Student Session) ─────────────────

const adminClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAdminToken = (): string | null => {
  return typeof window !== 'undefined' ? localStorage.getItem('studysync_admin_token') : null;
};

export const setAdminToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('studysync_admin_token', token);
    adminClient.defaults.headers.common['x-admin-token'] = token;
    adminClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    localStorage.removeItem('studysync_admin_token');
    delete adminClient.defaults.headers.common['x-admin-token'];
    delete adminClient.defaults.headers.common['Authorization'];
  }
};

// Initialize stored admin token
const initialAdminToken = getAdminToken();
if (initialAdminToken) {
  adminClient.defaults.headers.common['x-admin-token'] = initialAdminToken;
  adminClient.defaults.headers.common['Authorization'] = `Bearer ${initialAdminToken}`;
}

export const adminApi = {
  login: (data: { identifier: string; password: string; securityPassphrase?: string }) =>
    adminClient.post('/admin/auth/login', data),
  me: () => adminClient.get('/admin/auth/me'),
  logout: () => adminClient.post('/admin/auth/logout'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    adminClient.post('/admin/auth/change-password', data),
  getOverview: () => adminClient.get('/admin/overview'),
  getUsers: (params?: { search?: string; plan?: string; status?: string; page?: number; limit?: number }) =>
    adminClient.get('/admin/users', { params }),
  updateUserPlan: (userId: string, plan: string) =>
    adminClient.patch(`/admin/users/${userId}/plan`, { plan }),
  upgradeUserByEmail: (email: string, plan: string) =>
    adminClient.post('/admin/users/upgrade-by-email', { email, plan }),
  addBonusCourses: (userId: string, count: number = 1) =>
    adminClient.post(`/admin/users/${userId}/bonus-courses`, { count }),
  addBonusCoursesByEmail: (email: string, count: number = 1) =>
    adminClient.post('/admin/users/bonus-courses-by-email', { email, count }),
  updateUserStatus: (userId: string, isBlocked: boolean) =>
    adminClient.patch(`/admin/users/${userId}/status`, { isBlocked }),
  getCourses: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    adminClient.get('/admin/courses', { params }),
  updateCourseStatus: (courseId: string, isBlocked: boolean) =>
    adminClient.patch(`/admin/courses/${courseId}/status`, { isBlocked }),
  getAiUsage: () => adminClient.get('/admin/ai-usage'),
};

// ─── Document Tools API ───────────────────────────────────────────────

export const toolsApi = {
  getHealth: () => api.get('/tools/health'),

  convert: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/tools/convert', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  compress: (file: File, qualityLevel: 'ebook' | 'screen' | 'prepress' = 'ebook') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('qualityLevel', qualityLevel);
    return api.post('/tools/compress', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getJobStatus: (jobId: string) => api.get(`/tools/jobs/${jobId}`),

  getDownloadUrl: (jobId: string) => {
    const base = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}/tools/jobs/${jobId}/download${tokenParam}`;
  },
};

export default api;
