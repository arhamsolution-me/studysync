import { useState, useEffect } from 'react';
import {
  FileCode,
  FileText,
  Copy,
  Check,
  Download,
  Maximize2,
  Minimize2,
  X,
  Sparkles,
  Layers,
  Eye,
  Code2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import MermaidRenderer from './MermaidRenderer';
import MarkdownView from './MarkdownView';

export interface ArtifactSubFile {
  id: string;
  title: string;
  language?: string;
  content: string;
  downloadUrl?: string;
  type?: 'code' | 'file' | 'document' | 'video';
  description?: string;
}

export interface ArtifactItem {
  id: string;
  title: string;
  language?: string;
  content: string;
  downloadUrl?: string;
  type?: 'code' | 'file' | 'document' | 'video';
  sizeBytes?: number;
  description?: string;
  files?: ArtifactSubFile[];
}

interface ArtifactPanelProps {
  artifact: ArtifactItem | null;
  onClose: () => void;
}

function getFormatMeta(title: string, language?: string) {
  const cleanTitle = (title || '').trim();
  const ext = (cleanTitle.split('.').pop() || language || 'txt').toLowerCase();
  const lower = cleanTitle.toLowerCase();

  // Mermaid Diagram detection
  if (ext === 'mermaid' || language === 'mermaid' || cleanTitle.endsWith('.mermaid')) {
    return { label: 'DIAGRAM', color: '#0EA5E9', bg: '#F0F9FF', border: '#BAE6FD', isCode: true, isDoc: false, isDiagram: true };
  }

  // YouTube / Video detection
  if (
    ext === 'video' ||
    language === 'video' ||
    language === 'youtube' ||
    cleanTitle.toLowerCase().includes('youtube') ||
    cleanTitle.toLowerCase().endsWith('.video')
  ) {
    return { label: 'VIDEO', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', isCode: false, isDoc: false, isDiagram: false, isVideo: true };
  }

  // Document detection (Sick leave, letters, applications, essays)
  if (
    lower.includes('leave') ||
    lower.includes('application') ||
    lower.includes('letter') ||
    lower.includes('essay') ||
    lower.includes('report') ||
    ext === 'docx' ||
    ext === 'doc'
  ) {
    return { label: 'DOCUMENT', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', isCode: false, isDoc: true, isDiagram: false };
  }

  switch (ext) {
    case 'py':
    case 'python':
      return { label: 'PYTHON', color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A', isCode: true, isDoc: false, isDiagram: false };
    case 'js':
    case 'javascript':
      return { label: 'JAVASCRIPT', color: '#EAB308', bg: '#FEF9C3', border: '#FDE047', isCode: true, isDoc: false, isDiagram: false };
    case 'ts':
    case 'typescript':
      return { label: 'TYPESCRIPT', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', isCode: true, isDoc: false, isDiagram: false };
    case 'tsx':
    case 'jsx':
      return { label: 'REACT', color: '#0284C7', bg: '#F0F9FF', border: '#BAE6FD', isCode: true, isDoc: false, isDiagram: false };
    case 'cpp':
    case 'c':
      return { label: 'C++', color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', isCode: true, isDoc: false, isDiagram: false };
    case 'java':
      return { label: 'JAVA', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', isCode: true, isDoc: false, isDiagram: false };
    case 'html':
      return { label: 'HTML', color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5', isCode: true, isDoc: false, isDiagram: false };
    case 'css':
      return { label: 'CSS', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', isCode: true, isDoc: false, isDiagram: false };
    case 'sql':
      return { label: 'SQL', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', isCode: true, isDoc: false, isDiagram: false };
    case 'docx':
    case 'doc':
      return { label: 'DOCX', color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', isCode: false, isDoc: true, isDiagram: false };
    case 'pdf':
      return { label: 'PDF', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', isCode: false, isDoc: true, isDiagram: false };
    case 'csv':
      return { label: 'CSV', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', isCode: false, isDoc: false, isDiagram: false };
    case 'md':
    case 'markdown':
      return { label: 'MARKDOWN', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0', isCode: true, isDoc: false, isDiagram: false };
    default:
      return { label: (language || ext).toUpperCase(), color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', isCode: true, isDoc: false, isDiagram: false };
  }
}

export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'editor' | 'document' | 'diagram'>('editor');

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('studysync:artifact-closed'));
    onClose();
  };

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('studysync:artifact-closed'));
    };
  }, []);

  if (!artifact) return null;

  // Resolve active file from multi-file bundle or single artifact
  const hasMultipleFiles = Boolean(artifact.files && artifact.files.length > 1);
  const currentFile: ArtifactSubFile = (artifact.files && artifact.files[activeFileIndex]) || {
    id: artifact.id,
    title: artifact.title,
    language: artifact.language,
    content: artifact.content,
    downloadUrl: artifact.downloadUrl,
    type: artifact.type,
    description: artifact.description,
  };

  const meta = getFormatMeta(currentFile.title, currentFile.language);
  const isSource = Boolean(
    artifact.id?.startsWith('sources-') ||
    currentFile.id?.startsWith('src-sub') ||
    currentFile.title?.startsWith('Source ') ||
    artifact.title?.toLowerCase().includes('sources') ||
    artifact.title?.toLowerCase().includes('citations')
  );
  const isVideo = Boolean(
    (meta as any).isVideo ||
    currentFile.type === 'video' ||
    artifact.type === 'video' ||
    currentFile.language === 'video'
  );
  const isDocument = meta.isDoc || currentFile.type === 'document' || artifact.type === 'document' || isSource;
  const isDiagram = Boolean(meta.isDiagram || currentFile.language === 'mermaid' || currentFile.title?.endsWith('.mermaid'));
  const lines = currentFile.content ? currentFile.content.split('\n') : [];

  let videoData: any = null;
  if (isVideo) {
    try {
      videoData = JSON.parse(currentFile.content);
    } catch {
      videoData = { videoId: 'xsg9BDiwiJE', videoTitle: currentFile.title, chapters: [] };
    }
  }

  const [seekSeconds, setSeekSeconds] = useState<number>(videoData?.activeSeconds || 0);
  const [activeChapter, setActiveChapter] = useState<number>(0);

  useEffect(() => {
    if (videoData?.activeSeconds !== undefined) {
      setSeekSeconds(videoData.activeSeconds);
    }
  }, [currentFile.id]);

  useEffect(() => {
    if (isVideo) {
      setViewMode('document');
    } else if (isDiagram) {
      setViewMode('diagram');
    } else if (isDocument) {
      setViewMode('document');
    } else {
      setViewMode('editor');
    }
  }, [currentFile.id, isDiagram, isDocument, isVideo]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      toast.success('Copied to clipboard!', { duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownloadCurrent = () => {
    if (currentFile.downloadUrl) {
      window.open(currentFile.downloadUrl, '_blank');
      return;
    }

    try {
      const mimeType = isDocument ? 'text/plain;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([currentFile.content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.title || (isDiagram ? 'diagram.mermaid' : 'deliverable.txt');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${currentFile.title}!`, { duration: 2500 });
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDownloadAll = () => {
    if (!artifact.files || artifact.files.length <= 1) {
      handleDownloadCurrent();
      return;
    }

    // Sequentially download all files in the bundle
    artifact.files.forEach((file, index) => {
      setTimeout(() => {
        try {
          const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.title || `file_${index + 1}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }, index * 300);
    });
    toast.success(`Downloading all ${artifact.files.length} project files!`, { duration: 3000 });
  };

  return (
    <aside
      className={`artifact-side-panel ${isFullscreen ? 'artifact-fullscreen' : ''}`}
      aria-label="Code and Deliverable Artifact Panel"
    >
      {/* Header Bar */}
      <div className="artifact-header">
        <div className="artifact-header-left">
          <div className="artifact-icon-box">
            {isDiagram ? (
              <Sparkles size={17} color="#0EA5E9" />
            ) : isDocument ? (
              <FileText size={17} color={meta.color} />
            ) : hasMultipleFiles ? (
              <Layers size={17} color="#2563EB" />
            ) : (
              <FileCode size={17} color={meta.color} />
            )}
          </div>
          <div className="artifact-title-wrapper">
            <h3 className="artifact-title">
              {currentFile.title}
              {hasMultipleFiles && (
                <span className="artifact-bundle-badge">
                  ({activeFileIndex + 1}/{artifact.files!.length})
                </span>
              )}
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="artifact-header-actions">
          {/* Diagram / Code view toggle for Mermaid diagrams */}
          {isDiagram && (
            <div className="artifact-viewmode-toggle">
              <button
                type="button"
                className={`artifact-viewmode-btn ${viewMode === 'diagram' ? 'active' : ''}`}
                onClick={() => setViewMode('diagram')}
                title="Interactive Visual Diagram View"
              >
                <Sparkles size={12} />
                <span>Diagram</span>
              </button>
              <button
                type="button"
                className={`artifact-viewmode-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => setViewMode('editor')}
                title="Mermaid Syntax Code View"
              >
                <Code2 size={12} />
                <span>Code</span>
              </button>
            </div>
          )}

          {/* Document / Code view toggle for documents */}
          {isDocument && (
            <div className="artifact-viewmode-toggle">
              <button
                type="button"
                className={`artifact-viewmode-btn ${viewMode === 'document' ? 'active' : ''}`}
                onClick={() => setViewMode('document')}
                title="Formatted Preview"
              >
                <Eye size={12} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                className={`artifact-viewmode-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => setViewMode('editor')}
                title="Plain Code / Text"
              >
                <Code2 size={12} />
                <span>Raw</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="artifact-btn"
            onClick={handleCopy}
            title="Copy content to clipboard"
          >
            {copied ? (
              <>
                <Check size={14} color="#10B981" />
                <span style={{ color: '#10B981', fontWeight: 600 }}>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>

          {isVideo ? (
            <a
              href={videoData?.url || `https://www.youtube.com/watch?v=${videoData?.videoId || 'xsg9BDiwiJE'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="artifact-btn artifact-btn-primary"
              style={{ textDecoration: 'none' }}
              title="Open video on YouTube"
            >
              <ExternalLink size={13} />
              <span>Watch on YouTube</span>
            </a>
          ) : hasMultipleFiles ? (
            <div className="artifact-download-group">
              <button
                type="button"
                className="artifact-btn artifact-btn-primary"
                onClick={handleDownloadCurrent}
                title={`Download ${currentFile.title}`}
              >
                <Download size={13} />
                <span>File</span>
              </button>
              <button
                type="button"
                className="artifact-btn artifact-btn-secondary"
                onClick={handleDownloadAll}
                title="Download all project files"
              >
                <span>All ({artifact.files!.length})</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="artifact-btn artifact-btn-primary"
              onClick={handleDownloadCurrent}
              title={`Download ${currentFile.title}`}
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          )}

          <button
            type="button"
            className="artifact-icon-button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            type="button"
            className="artifact-icon-button artifact-close-btn"
            onClick={handleClose}
            title="Close Panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Multi-File Tab Bar */}
      {hasMultipleFiles && (
        <div className="artifact-tabs-bar" role="tablist">
          {artifact.files!.map((file, idx) => {
            const fileMeta = getFormatMeta(file.title, file.language);
            const isActive = idx === activeFileIndex;
            // Keep tab title to 1-2 words (clean & compact)
            const cleanTitle = file.title.length > 18
              ? `${file.title.slice(0, 15)}…`
              : file.title;

            return (
              <button
                key={file.id || idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`artifact-tab-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveFileIndex(idx)}
                title={file.title}
              >
                <span
                  className="artifact-tab-dot"
                  style={{ backgroundColor: fileMeta.color }}
                />
                <span className="artifact-tab-title">{cleanTitle}</span>
                {!isSource && fileMeta.label !== 'DOCUMENT' && (
                  <span className="artifact-tab-lang">{fileMeta.label}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Body: Direct Clean Content View or Code Editor */}
      <div className="artifact-body">
        {isVideo ? (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, height: '100%', overflowY: 'auto' }}>
            {/* Embedded Player */}
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden', background: '#0F172A', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }}>
              <iframe
                key={`${videoData?.videoId}-${seekSeconds}`}
                src={`https://www.youtube-nocookie.com/embed/${videoData?.videoId || 'xsg9BDiwiJE'}?start=${seekSeconds}&autoplay=1&rel=0`}
                title={videoData?.videoTitle || currentFile.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              />
            </div>

            {/* Video Title & Metadata */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 600, color: '#0F172A' }}>
                  {videoData?.videoTitle || currentFile.title}
                </h3>
                {videoData?.author && (
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748B', fontWeight: 500 }}>
                    {videoData.author}
                  </p>
                )}
              </div>

              {videoData?.url && (
                <a
                  href={videoData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 7,
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    color: '#475569',
                    fontSize: '0.78rem',
                    textDecoration: 'none',
                    fontWeight: 500,
                    flexShrink: 0,
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Open on YouTube</span>
                </a>
              )}
            </div>

            {/* Interactive Chapters List */}
            {videoData?.chapters && videoData.chapters.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 600, color: '#334155' }}>
                  <Clock size={15} color="#4F46E5" />
                  <span>Interactive Chapters (Click to Jump & Play):</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {videoData.chapters.map((ch: any, idx: number) => {
                    const isCurrent = activeChapter === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSeekSeconds(ch.seconds);
                          setActiveChapter(idx);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 8,
                          background: isCurrent ? '#EEF2FF' : '#F8FAFC',
                          border: isCurrent ? '1px solid #818CF8' : '1px solid #E2E8F0',
                          color: isCurrent ? '#3730A3' : '#334155',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            background: isCurrent ? '#4F46E5' : '#E2E8F0',
                            color: isCurrent ? '#FFFFFF' : '#475569',
                            padding: '2px 7px',
                            borderRadius: 5,
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          {ch.time}
                        </span>
                        <span style={{ fontSize: '0.84rem', fontWeight: isCurrent ? 600 : 500 }}>
                          {ch.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : isDiagram && viewMode === 'diagram' ? (
          /* Interactive Mermaid Vector Diagram Viewer */
          <div className="artifact-diagram-view-wrapper">
            <MermaidRenderer chart={currentFile.content} title={currentFile.title} />
          </div>
        ) : isDocument && viewMode === 'document' ? (
          /* Clean Direct Document View (No ribbons, No marketing clutter) */
          <div className="artifact-clean-document-view">
            <MarkdownView content={currentFile.content} />
          </div>
        ) : (
          /* High-Precision Code / Text Editor with Line Numbers */
          <div className="artifact-code-container">
            <div className="artifact-line-numbers" aria-hidden="true">
              {lines.map((_, i) => (
                <span key={i} className="artifact-line-num">
                  {i + 1}
                </span>
              ))}
            </div>

            <pre className="artifact-code-content">
              <code>
                {lines.map((line, i) => (
                  <div key={i} className="artifact-code-row">
                    {line || ' '}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Clean Minimal Footer */}
      <div className="artifact-footer">
        <div className="artifact-footer-status">
          <span className="artifact-status-dot" />
          <span>{lines.length} lines</span>
        </div>
        <span className="artifact-footer-label">{meta.label}</span>
      </div>
    </aside>
  );
}
