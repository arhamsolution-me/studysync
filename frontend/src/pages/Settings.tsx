import { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Eye,
  CheckCircle2,
  Sparkles,
  LogOut,
  Inbox,
  MessageSquare,
  Smartphone,
  QrCode,
  RefreshCw,
  Power,
  KeyRound,
  ShieldCheck,
  Cpu,
  Trash2,
  Lock,
  Crown,
  Check,
  Loader2,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsApi, authApi, whatsappApi, apiKeyApi } from '../services/api';

interface SettingsProps {
  user: {
    id?: string;
    fullName: string;
    email: string;
    reminderLeadTimeMins?: number;
    whatsappNumber?: string;
    hasGoogleConnected?: boolean;
    plan?: string;
    aiProviderPreference?: string;
    activeByokProvider?: string;
  };
  onUpdateUser?: (updated: any) => void;
  onLogout?: () => void;
}

export default function Settings({ user, onUpdateUser, onLogout }: SettingsProps) {
  const [email, setEmail] = useState(user.email || '');
  const [fullName, setFullName] = useState(user.fullName || '');
  const [leadTime, setLeadTime] = useState(user.reminderLeadTimeMins || 1440);

  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingDigest, setIsSendingDigest] = useState(false);

  // BYOK & Plan States
  const [aiPreference, setAiPreference] = useState<'system' | 'byok'>('system');
  const [activeByokProvider, setActiveByokProvider] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<'free' | 'pro'>('free');
  const [storedKeys, setStoredKeys] = useState<any[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState<'groq' | 'gemini' | 'openai'>('groq');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isTestingNewKey, setIsTestingNewKey] = useState(false);
  const [isSavingNewKey, setIsSavingNewKey] = useState(false);
  const [newKeyVerified, setNewKeyVerified] = useState(false);
  const [newKeyMasked, setNewKeyMasked] = useState('');
  const [digestPreview, setDigestPreview] = useState<{
    email: { subject: string; body: string };
    pendingTasksCount: number;
  } | null>(null);

  // WhatsApp Agent State
  const [waStatus, setWaStatus] = useState<{
    isConnected: boolean;
    isConnecting: boolean;
    phoneNumber: string | null;
    qrCode: string | null;
    lastError: string | null;
  }>({
    isConnected: false,
    isConnecting: false,
    phoneNumber: null,
    qrCode: null,
    lastError: null,
  });
  const [isLoadingWa, setIsLoadingWa] = useState(false);
  const [isSendingWaTest, setIsSendingWaTest] = useState(false);

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await whatsappApi.getStatus();
      if (res.data?.data) {
        setWaStatus(res.data.data);
      }
    } catch {
      // ignore poll error
    }
  };

  const fetchUserKeys = async () => {
    try {
      const res = await apiKeyApi.listKeys();
      if (res.data?.data) {
        setAiPreference(res.data.data.aiProviderPreference || 'system');
        setActiveByokProvider(res.data.data.activeByokProvider || null);
        setCurrentPlan(res.data.data.plan || 'free');
        setStoredKeys(res.data.data.keys || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchWhatsAppStatus();
    fetchUserKeys();
    const interval = setInterval(fetchWhatsAppStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAiPreference = async (pref: 'system' | 'byok') => {
    try {
      setAiPreference(pref);
      await apiKeyApi.setPreference(pref, activeByokProvider || undefined);
      toast.success(`AI routing switched to ${pref === 'system' ? 'Managed Platform Pool' : 'BYOK Keys'}`);
    } catch {
      toast.error('Failed to update AI preference.');
    }
  };

  const handleTestNewKey = async () => {
    if (!newKeyInput.trim()) {
      toast.error('Please enter an API key first.');
      return;
    }
    setIsTestingNewKey(true);
    setNewKeyVerified(false);
    try {
      const res = await apiKeyApi.testKey(newKeyProvider, newKeyInput.trim());
      if (res.data?.success) {
        setNewKeyVerified(true);
        setNewKeyMasked(res.data.maskedKey || '••••••••');
        toast.success(`${newKeyProvider.toUpperCase()} key is verified and live!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed. Key was rejected by provider.');
    } finally {
      setIsTestingNewKey(false);
    }
  };

  const handleSaveNewKey = async () => {
    if (!newKeyInput.trim()) return;
    setIsSavingNewKey(true);
    try {
      await apiKeyApi.saveKey(newKeyProvider, newKeyInput.trim(), true);
      toast.success(`${newKeyProvider.toUpperCase()} key safely encrypted with AES-256-GCM and saved!`);
      setNewKeyInput('');
      setNewKeyVerified(false);
      setNewKeyMasked('');
      await fetchUserKeys();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save encrypted key.');
    } finally {
      setIsSavingNewKey(false);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      await apiKeyApi.deleteKey(provider);
      toast.success(`${provider.toUpperCase()} key removed.`);
      await fetchUserKeys();
    } catch {
      toast.error('Failed to remove key.');
    }
  };

  const handleConnectWa = async () => {
    setIsLoadingWa(true);
    try {
      await whatsappApi.connect();
      toast.success('WhatsApp connection initialized! Scan the QR code.');
      await fetchWhatsAppStatus();
    } catch {
      toast.error('Failed to initialize WhatsApp connection.');
    } finally {
      setIsLoadingWa(false);
    }
  };

  const handleDisconnectWa = async () => {
    setIsLoadingWa(true);
    try {
      await whatsappApi.disconnect();
      toast.success('WhatsApp disconnected successfully.');
      await fetchWhatsAppStatus();
    } catch {
      toast.error('Failed to disconnect WhatsApp.');
    } finally {
      setIsLoadingWa(false);
    }
  };

  const handleSendWaTest = async () => {
    setIsSendingWaTest(true);
    try {
      const res = await whatsappApi.sendTest();
      toast.success(res.data?.message || 'Test message sent to your WhatsApp!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send WhatsApp test message.');
    } finally {
      setIsSendingWaTest(false);
    }
  };

  useEffect(() => {
    if (user.email) setEmail(user.email);
    if (user.fullName) setFullName(user.fullName);
    if (user.reminderLeadTimeMins) setLeadTime(user.reminderLeadTimeMins);
  }, [user]);

  const handleSaveEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter a valid email address.');
      return;
    }
    setIsSavingEmail(true);
    try {
      const res = await authApi.updateProfile({ email: trimmed, reminderLeadTimeMins: leadTime });
      if (res.data?.data?.user) {
        onUpdateUser?.(res.data.data.user);
      }
      toast.success(`Target email updated! Alerts will be sent to ${trimmed}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update email.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error('Name cannot be empty.');
      return;
    }
    setIsSavingName(true);
    try {
      const res = await authApi.updateProfile({ fullName: trimmed });
      if (res.data?.data?.user) {
        onUpdateUser?.(res.data.data.user);
      }
      toast.success('Name updated successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update name.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSendTestEmail = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      toast.error('Please enter an email address first.');
      return;
    }
    setIsSendingTest(true);
    try {
      const res = await notificationsApi.sendTestEmail(targetEmail);
      toast.success(res.data?.message || `Test email sent to ${targetEmail}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send test email.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleTriggerDigest = async () => {
    setIsSendingDigest(true);
    try {
      const res = await notificationsApi.triggerDigest();
      toast.success(res.data?.message || 'Daily pending tasks digest sent!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send digest email.');
    } finally {
      setIsSendingDigest(false);
    }
  };

  const handlePreviewDigest = async () => {
    try {
      const res = await notificationsApi.previewDigest();
      setDigestPreview(res.data?.data);
      toast.success('Email preview loaded.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load preview.');
    }
  };

  const handleLeadTimeChange = async (val: number) => {
    setLeadTime(val);
    try {
      await authApi.updateProfile({ reminderLeadTimeMins: val });
      toast.success('Reminder lead time updated.');
    } catch {
      toast.error('Failed to update reminder lead time.');
    }
  };

  const leadTimeOptions = [
    { label: 'On the day of deadline (9:00 AM)', value: 0 },
    { label: '1 day before (Default)', value: 1440 },
    { label: '2 days before', value: 2880 },
    { label: '3 days before', value: 4320 },
    { label: '5 days before', value: 7200 },
    { label: '1 week before (7 days)', value: 10080 },
    { label: '2 weeks before (14 days)', value: 20160 },
  ];

  const getInitials = (name: string) => {
    if (!name) return 'S';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ width: '100%', maxWidth: '860px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* ─── Page Header ───────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '6px' }}>
          Settings & Preferences
        </h1>
        <p style={{ color: '#64748B', fontSize: '0.88rem' }}>
          Manage your student profile, automated email notifications, reminder frequencies, and academic account settings.
        </p>
      </div>

      {/* ─── Unified Seamless Settings Surface (No Cards) ─────────── */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── SECTION 1: PROFILE & IDENTITY ──────────────────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                color: '#FFFFFF',
                fontSize: '1.25rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)',
                flexShrink: 0,
              }}
            >
              {getInitials(fullName)}
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                {fullName || 'Student'}
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#6366F1',
                  background: '#EEF2FF',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  marginTop: 4,
                }}
              >
                <Sparkles size={11} /> Verified Academic Student
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Full Name Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 160 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B', display: 'block' }}>
                  Full Name
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Your display name across StudySync
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 380 }}>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter full name"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {isSavingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Email Address Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingTop: 12, borderTop: '1px solid #F8FAFC' }}>
              <div style={{ minWidth: 160 }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B', display: 'block' }}>
                  Target Email Address
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Where quiz & deadline alerts are sent
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 380 }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveEmail}
                  disabled={isSavingEmail}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {isSavingEmail ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: AUTOMATED EMAIL & ALERTS ──────────────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Mail size={18} color="#6366F1" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Automated Email Reminders & Delivery
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* SMTP Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={18} color="#16A34A" />
                <div>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#15803D', display: 'block' }}>
                    Gmail SMTP Dispatched via devnexes.support@gmail.com
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#166534' }}>
                    Day-wise and week-wise email reminders are active: 1 Week before, 3 Days before, and 1 Day before deadlines.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSendingTest}
                style={{
                  padding: '6px 12px',
                  background: '#FFFFFF',
                  color: '#15803D',
                  border: '1px solid #86EFAC',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  flexShrink: 0,
                }}
              >
                <Send size={12} />
                <span>{isSendingTest ? 'Sending...' : 'Send Test Email'}</span>
              </button>
            </div>

            {/* Reminder Lead Time Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B', display: 'block' }}>
                  Default Reminder Lead Time
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Select primary email alert timing for new tasks
                </span>
              </div>
              <select
                value={leadTime}
                onChange={(e) => handleLeadTimeChange(Number(e.target.value))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.86rem',
                  outline: 'none',
                  background: '#FFFFFF',
                  fontWeight: 500,
                  color: '#0F172A',
                  cursor: 'pointer',
                  minWidth: 200,
                }}
              >
                {leadTimeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── SECTION: WHATSAPP AGENT & REAL-TIME SYNC ───────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9', background: '#F8FDF9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={19} color="#16A34A" />
              </div>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  WhatsApp Agent & Multi-Device Sync
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                  Connect your WhatsApp to study, manage deadlines, and receive 24h study plan alerts.
                </span>
              </div>
            </div>

            {/* Live Status Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 9999,
                fontSize: '0.76rem',
                fontWeight: 600,
                background: waStatus.isConnected ? '#DCFCE7' : waStatus.qrCode ? '#FEF3C7' : '#F1F5F9',
                color: waStatus.isConnected ? '#15803D' : waStatus.qrCode ? '#B45309' : '#64748B',
                border: `1px solid ${waStatus.isConnected ? '#86EFAC' : waStatus.qrCode ? '#FCD34D' : '#E2E8F0'}`,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: waStatus.isConnected ? '#16A34A' : waStatus.qrCode ? '#D97706' : '#94A3B8',
                }}
              />
              {waStatus.isConnected
                ? `Connected (${waStatus.phoneNumber ? `+${waStatus.phoneNumber}` : 'Active'})`
                : waStatus.qrCode
                ? 'Scan QR to Link'
                : 'Offline'}
            </div>
          </div>

          {/* Connection Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {waStatus.isConnected ? (
              /* Connected State */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  background: '#FFFFFF',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#F0FDF4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #86EFAC',
                    }}
                  >
                    <Smartphone size={20} color="#16A34A" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803D' }}>
                      Active WhatsApp Multi-Device Session
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#4B5563', marginTop: 2 }}>
                      Linked phone: <strong>+{waStatus.phoneNumber || 'User'}</strong> • Ready for "Message yourself" or direct commands.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleSendWaTest}
                    disabled={isSendingWaTest}
                    style={{
                      padding: '7px 13px',
                      background: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Send size={12} />
                    <span>{isSendingWaTest ? 'Sending...' : 'Send Test Ping'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectWa}
                    disabled={isLoadingWa}
                    style={{
                      padding: '7px 13px',
                      background: '#FFFFFF',
                      color: '#DC2626',
                      border: '1px solid #FECACA',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Power size={12} />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            ) : waStatus.qrCode ? (
              /* QR Code Scan Required State */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  padding: '20px 22px',
                  background: '#FFFFFF',
                  border: '1px solid #FCD34D',
                  borderRadius: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    padding: 10,
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <img
                    src={waStatus.qrCode}
                    alt="WhatsApp QR Code"
                    style={{ width: 170, height: 170, display: 'block', borderRadius: 6 }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 6, fontWeight: 600 }}>
                    Auto-refreshes live
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                    Scan QR Code with your WhatsApp:
                  </div>
                  <ol style={{ fontSize: '0.78rem', color: '#475569', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Settings</strong> (iOS) or <strong>Three Dots ⋮</strong> (Android)</li>
                    <li>Select <strong>Linked Devices</strong> ➔ <strong>Link a Device</strong></li>
                    <li>Point your phone's camera at this QR code</li>
                    <li>Once connected, send <strong>agent on</strong> in WhatsApp to start!</li>
                  </ol>

                  <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleConnectWa}
                      disabled={isLoadingWa}
                      style={{
                        padding: '6px 12px',
                        background: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        borderRadius: 7,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <RefreshCw size={12} className={isLoadingWa ? 'animate-spin' : ''} />
                      <span>Refresh QR Code</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Disconnected State */
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 18px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1E293B' }}>
                    WhatsApp Agent is currently Offline
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: 2 }}>
                    Click below to generate a QR code and link your WhatsApp multi-device session.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConnectWa}
                  disabled={isLoadingWa}
                  style={{
                    padding: '8px 16px',
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 2px 4px rgba(22,163,74,0.2)',
                  }}
                >
                  <QrCode size={14} />
                  <span>{isLoadingWa ? 'Starting...' : 'Link WhatsApp (QR Code)'}</span>
                </button>
              </div>
            )}

            {/* Special Commands Cheatsheet */}
            <div
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
                💡 WhatsApp Special Command Cheatsheet:
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 8,
                }}
              >
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                  <code style={{ color: '#16A34A', fontWeight: 700, fontSize: '0.78rem' }}>agent on</code>
                  <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: 2 }}>
                    Activates assistant and lists enrolled courses.
                  </span>
                </div>
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                  <code style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.78rem' }}>Course &lt;Course Name&gt;</code>
                  <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: 2 }}>
                    Enters course chatbot (e.g. <code>Course Database Systems</code>, <code>Course OS</code>).
                  </span>
                </div>
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                  <code style={{ color: '#D97706', fontWeight: 700, fontSize: '0.78rem' }}>"Kal quiz ha 5 baje"</code>
                  <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: 2 }}>
                    Auto-schedules calendar task and arms 24h WhatsApp reminder.
                  </span>
                </div>
                <div style={{ padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
                  <code style={{ color: '#DC2626', fontWeight: 700, fontSize: '0.78rem' }}>exit</code>
                  <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: 2 }}>
                    Leaves active course chatbot and returns to agent standby menu.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 3: DAILY DIGEST & PREVIEWS ───────────────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Inbox size={18} color="#6366F1" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Daily Pending Tasks Digest
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#1E293B', display: 'block' }}>
                Summary Email Dispatches
              </span>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Sends a morning overview of upcoming assignments, quizzes, and projects.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={handlePreviewDigest}
                style={{
                  padding: '8px 12px',
                  background: '#F8FAFC',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Eye size={13} />
                <span>Preview Email</span>
              </button>
              <button
                type="button"
                onClick={handleTriggerDigest}
                disabled={isSendingDigest}
                style={{
                  padding: '8px 14px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Send size={13} />
                <span>{isSendingDigest ? 'Sending...' : 'Send Digest Now'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Preview Card */}
          {digestPreview && (
            <div
              style={{
                marginTop: 16,
                padding: '14px 16px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>
                Subject: {digestPreview.email.subject}
              </div>
              <div style={{ color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {digestPreview.email.body}
              </div>
            </div>
          )}
        </div>

        {/* ─── SECTION 4: AI ENGINE & BYOK API KEYS ─────────────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                AI Engine & BYOK API Keys
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                Choose between platform-managed multi-key rotation or your own private API keys.
              </p>
            </div>
            <div className="ob-enc-badge">
              <ShieldCheck size={14} color="#059669" />
              <span>AES-256-GCM Encrypted</span>
            </div>
          </div>

          {/* AI Routing Mode Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div
              onClick={() => handleToggleAiPreference('system')}
              className={`ob-card-selectable ${aiPreference === 'system' ? 'active' : ''}`}
              style={{ padding: '14px 16px', borderRadius: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cpu size={16} color="#6366F1" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1E293B' }}>Auto Platform Managed</span>
                </div>
                {aiPreference === 'system' && (
                  <div className="ob-check-bloom">
                    <CheckCircle2 size={16} color="#6366F1" />
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Uses StudySync high-speed rotation pool. No configuration needed.
              </span>
            </div>

            <div
              onClick={() => handleToggleAiPreference('byok')}
              className={`ob-card-selectable ${aiPreference === 'byok' ? 'active' : ''}`}
              style={{ padding: '14px 16px', borderRadius: '10px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <KeyRound size={16} color="#059669" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#1E293B' }}>Bring Your Own Key (BYOK)</span>
                </div>
                {aiPreference === 'byok' && (
                  <div className="ob-check-bloom">
                    <CheckCircle2 size={16} color="#059669" />
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                Use your private Gemini, OpenAI, or Groq keys with direct rate limits.
              </span>
            </div>
          </div>

          {/* Stored Keys List */}
          {storedKeys.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Configured Private Keys
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {storedKeys.map((k) => (
                  <div
                    key={k.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: '#EEF2FF',
                          color: '#4338CA',
                        }}
                      >
                        {k.provider}
                      </span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#334155' }}>
                        {k.maskedKey}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                        <Check size={12} strokeWidth={3} /> Active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(k.provider)}
                      title="Remove key"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add / Update Key Box */}
          <div style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1E293B', display: 'block', marginBottom: 8 }}>
              Add or Update an API Key
            </span>

            {/* Provider Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['groq', 'gemini', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setNewKeyProvider(p);
                    setNewKeyVerified(false);
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: newKeyProvider === p ? '1.5px solid #6366F1' : '1px solid #CBD5E1',
                    background: newKeyProvider === p ? '#EEF2FF' : '#FFFFFF',
                    color: newKeyProvider === p ? '#4338CA' : '#475569',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input & Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Lock size={13} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => {
                    setNewKeyInput(e.target.value);
                    setNewKeyVerified(false);
                  }}
                  placeholder={`Paste ${newKeyProvider.toUpperCase()} key`}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 30px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleTestNewKey}
                disabled={isTestingNewKey || !newKeyInput.trim()}
                className={`ob-btn-ripple ${isTestingNewKey ? 'ob-btn-testing' : ''}`}
                style={{
                  padding: '8px 12px',
                  background: newKeyVerified ? '#10B981' : '#6366F1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: isTestingNewKey || !newKeyInput.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {isTestingNewKey ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : newKeyVerified ? (
                  <>
                    <Check size={12} strokeWidth={3} />
                    <span>Verified!</span>
                  </>
                ) : (
                  <span>Test Key</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveNewKey}
                disabled={isSavingNewKey || !newKeyInput.trim()}
                style={{
                  padding: '8px 14px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: isSavingNewKey || !newKeyInput.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSavingNewKey ? 'Encrypting...' : 'Save Key'}
              </button>
            </div>

            {newKeyVerified && newKeyMasked && (
              <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Check size={13} strokeWidth={3} />
                <span>Verified: <strong>{newKeyMasked}</strong> (Ready to encrypt with AES-256-GCM)</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── SECTION 5: SUBSCRIPTION & BILLING ─────────────────────── */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Subscription & Workspace Plan
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.78rem', margin: '4px 0 0 0' }}>
                Academic tier status and capacity limits.
              </p>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: '9999px',
                background: currentPlan === 'pro' ? '#EEF2FF' : '#F1F5F9',
                color: currentPlan === 'pro' ? '#4338CA' : '#475569',
                border: currentPlan === 'pro' ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              {currentPlan === 'pro' && <Crown size={12} />}
              {currentPlan.toUpperCase()} TIER
            </span>
          </div>

          <div
            style={{
              padding: '16px 18px',
              background: currentPlan === 'pro' ? 'linear-gradient(135deg, #FAF5FF 0%, #EEF2FF 100%)' : '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A' }}>
                {currentPlan === 'pro' ? 'Pro Student Membership' : 'Free Starter Plan'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                {currentPlan === 'pro'
                  ? 'Unlimited AI vector storage, 120B parameter reasoning, and priority WhatsApp sync.'
                  : 'Up to 5 active courses with standard automated email reminders.'}
              </div>
            </div>

            {currentPlan !== 'pro' && (
              <button
                type="button"
                onClick={() => toast.success('Pro plan demo activated!')}
                style={{
                  padding: '7px 14px',
                  background: '#6366F1',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Zap size={13} />
                <span>Upgrade to Pro ($9)</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── SECTION 6: SECURITY & ACCOUNT ACTIONS ───────────────── */}
        <div style={{ padding: '20px 28px', background: '#FAFAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
              StudySync Personal Workspace • v2.0
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94A3B8', display: 'block' }}>
              All database sessions and chat histories are locally encrypted and synced.
            </span>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
