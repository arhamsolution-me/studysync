import {
  FileCode,
  FileText,
  FileSpreadsheet,
  Download,
  Code,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface FileDeliveryItem {
  filepath: string;
  title: string;
  description?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  previewText?: string;
}

export interface FileDeliveryWidgetProps {
  data: FileDeliveryItem[] | FileDeliveryItem;
}

function getFileFormatMeta(filepath: string) {
  const ext = (filepath.split('.').pop() || '').toLowerCase();
  const isCode = ['py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'sql', 'c', 'cpp', 'java', 'sh'].includes(ext);

  switch (ext) {
    case 'docx':
    case 'doc':
      return {
        label: 'DOCX',
        typeLabel: 'Word Document',
        icon: FileText,
        bg: '#EFF6FF',
        color: '#2563EB',
        border: '#BFDBFE',
        isCode: false,
      };
    case 'pdf':
      return {
        label: 'PDF',
        typeLabel: 'PDF Document',
        icon: FileText,
        bg: '#FEF2F2',
        color: '#DC2626',
        border: '#FECACA',
        isCode: false,
      };
    case 'py':
      return {
        label: 'PYTHON',
        typeLabel: 'Python Script',
        icon: FileCode,
        bg: '#FEFCE8',
        color: '#CA8A04',
        border: '#FEF08A',
        isCode: true,
      };
    case 'csv':
    case 'xlsx':
      return {
        label: 'CSV',
        typeLabel: 'Spreadsheet',
        icon: FileSpreadsheet,
        bg: '#F0FDF4',
        color: '#15803D',
        border: '#BBF7D0',
        isCode: false,
      };
    case 'md':
      return {
        label: 'MARKDOWN',
        typeLabel: 'Markdown Notes',
        icon: FileText,
        bg: '#F8FAFC',
        color: '#475569',
        border: '#E2E8F0',
        isCode: false,
      };
    case 'js':
    case 'ts':
    case 'json':
    case 'html':
    case 'css':
      return {
        label: ext.toUpperCase(),
        typeLabel: 'Code File',
        icon: FileCode,
        bg: '#EEF2FF',
        color: '#4F46E5',
        border: '#C7D2FE',
        isCode: true,
      };
    default:
      return {
        label: ext ? ext.toUpperCase() : 'TXT',
        typeLabel: isCode ? 'Code File' : 'Text File',
        icon: isCode ? FileCode : FileText,
        bg: '#F1F5F9',
        color: '#334155',
        border: '#CBD5E1',
        isCode,
      };
  }
}

export default function FileDeliveryWidget({ data }: FileDeliveryWidgetProps) {
  const files: FileDeliveryItem[] = Array.isArray(data) ? data : data ? [data] : [];

  if (files.length === 0) return null;

  const getCleanFilename = (file: FileDeliveryItem) => {
    if (file.filepath) {
      const base = file.filepath.split(/[\\/]/).pop();
      if (base) return base;
    }
    if (file.title && file.title.includes('.')) return file.title;
    return `${file.title || 'document'}.txt`;
  };

  const resolveDownloadUrl = (rawUrl?: string) => {
    if (!rawUrl) return '#';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    return `http://localhost:5000${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  const handleDownload = (file: FileDeliveryItem) => {
    const cleanName = getCleanFilename(file);
    const fullUrl = resolveDownloadUrl(file.downloadUrl);

    // Direct browser download
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = cleanName;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded: ${cleanName}`, { icon: '📥' });
  };

  const handleOpenInSidePanel = async (file: FileDeliveryItem) => {
    const cleanName = getCleanFilename(file);
    const meta = getFileFormatMeta(cleanName);
    let textContent = file.previewText || '';

    if (!textContent) {
      try {
        const previewUrl = resolveDownloadUrl(file.downloadUrl).replace('download=true', 'download=false');
        const res = await fetch(previewUrl);
        if (res.ok) {
          textContent = await res.text();
        }
      } catch { }
    }

    if (!textContent) {
      textContent = `File: ${cleanName}\nFormat: ${meta.typeLabel}\n\nReady for download: ${resolveDownloadUrl(file.downloadUrl)}`;
    }

    window.dispatchEvent(
      new CustomEvent('studysync:open-artifact', {
        detail: {
          id: `widget-file-${Date.now()}`,
          title: cleanName,
          language: cleanName.split('.').pop() || 'text',
          content: textContent,
          downloadUrl: resolveDownloadUrl(file.downloadUrl),
          type: meta.isCode ? 'code' : 'file',
          sizeBytes: file.sizeBytes,
          description: file.description,
        },
      })
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0', width: '100%' }}>
      {files.map((file, idx) => {
        const cleanName = getCleanFilename(file);
        const meta = getFileFormatMeta(cleanName);
        const Icon = meta.icon;
        const sizeFormatted = file.sizeBytes
          ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
          : 'Ready';
        const fullDownloadUrl = resolveDownloadUrl(file.downloadUrl);

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Sleek single-layer attachment card */}
            <div
              onClick={() => handleOpenInSidePanel(file)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              }}
              title={`Click to open ${cleanName} in right-side window`}
            >
              {/* Left: Icon and Direct Interactive Link */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <a
                  href={fullDownloadUrl}
                  download={cleanName}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDownload(file);
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: meta.bg,
                    border: `1px solid ${meta.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  title={`Download ${cleanName}`}
                >
                  <Icon size={18} color={meta.color} />
                </a>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* The name itself is the link */}
                    <a
                      href={fullDownloadUrl}
                      download={cleanName}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDownload(file);
                      }}
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: '#2563EB',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#1D4ED8';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#2563EB';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                      title={`Click to download ${cleanName}`}
                    >
                      {cleanName}
                    </a>

                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: meta.bg,
                        color: meta.color,
                        border: `1px solid ${meta.border}`,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    {meta.typeLabel} • {sizeFormatted}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Open in Right-Side Window */}
                <button
                  type="button"
                  onClick={() => handleOpenInSidePanel(file)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '7px 13px',
                    background: '#F8FAFC',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#EFF6FF';
                    e.currentTarget.style.color = '#2563EB';
                    e.currentTarget.style.borderColor = '#93C5FD';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F8FAFC';
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.borderColor = '#CBD5E1';
                  }}
                  title="Open in right-side window"
                >
                  <Code size={13} color="#4F46E5" />
                  <span>Open in Window ↗</span>
                </button>

                {/* Direct Download Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(file);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.22)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#4338CA';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#4F46E5';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  title={`Download ${cleanName}`}
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
