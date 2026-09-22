import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowUp,
  RotateCcw,
  ChevronDown,
  Paperclip,
  UploadCloud,
  Loader2,
  Mic,
  Image as ImageIcon,
  X,
  Copy,
  Check,
  FileText,
  FileAudio,
  Plus,
  Pencil,
  Sparkles,
  ArrowUpRight,
  Volume2,
  VolumeX,
  Eye,
  AudioWaveform,
  Square,
  Download,
  FileCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesApi, voiceApi } from '../services/api';
import MarkdownView, { isDiagramBlock } from '../components/MarkdownView';
import WidgetRenderer from '../components/widgets/WidgetRenderer';
import ThinkingBlock, { LiveThinkingIndicator, AnimatedThinkingBook } from '../components/ThinkingBlock';
import ArtifactPanel, { type ArtifactItem, type ArtifactSubFile } from '../components/ArtifactPanel';

interface Course {
  id: string;
  name: string;
  colorTag: string;
}

interface SourceItem {
  text: string;
  score: number;
  filename?: string;
}

interface ChatMessage {
  id: string;
  courseId: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: SourceItem[];
  imageUrl?: string;
  imageUrls?: string[];
  attachedFile?: { name: string; type: string };
  attachedFiles?: Array<{ name: string; type: string; size?: number; previewUrl?: string }>;
  widgets?: any[];
  toolCalls?: any[];
  thought?: string;
  thoughtDurationSeconds?: number;
  artifact?: ArtifactItem;
  isStreaming?: boolean;
}

interface AttachedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  isImage: boolean;
  isAudio: boolean;
  isDoc: boolean;
  previewUrl?: string;
  status: 'reading' | 'ready' | 'error';
  progress: number;
  errorMsg?: string;
}

function getFileBadgeInfo(filename: string, mimeType: string) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) {
    return { label: 'PDF', bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' };
  }
  if (['doc', 'docx', 'rtf'].includes(ext)) {
    return { label: 'DOC', bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' };
  }
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return { label: 'PPT', bg: '#FFEDD5', color: '#EA580C', border: '#FDBA74' };
  }
  if (['xls', 'xlsx', 'ods'].includes(ext)) {
    return { label: 'XLS', bg: '#DCFCE7', color: '#16A34A', border: '#BBF7D0' };
  }
  if (['txt', 'md', 'json', 'csv'].includes(ext)) {
    return { label: ext.toUpperCase() || 'TXT', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) {
    return { label: 'CODE', bg: '#D1FAE5', color: '#059669', border: '#A7F3D0' };
  }
  if (['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'flac'].includes(ext) || (mimeType && mimeType.startsWith('audio/'))) {
    return { label: 'AUDIO', bg: '#F3E8FF', color: '#9333EA', border: '#E9D5FF' };
  }
  if ((mimeType && mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) {
    return { label: 'IMG', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };
  }
  return { label: ext.toUpperCase() || 'FILE', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' };
}

function parseClarificationOptions(text: string): string[] {
  if (!text) return [];
  const isClarificationOrFollowUp = /(clarif|wazahat|kya aap in|did you mean|which topic|specify|samajh nahi|unclear|referring to|kis baare|options|ikhtiyarat|poochna chah rahe|chunte hain|suggest|explore|follow-?up|choose|which of the following)/i.test(text);
  if (!isClarificationOrFollowUp) return [];

  const options: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+\.|\-|\*|•)\s+(.+)$/);
    if (match) {
      let opt = match[2].trim().replace(/\*\*/g, '').replace(/:\s*$/, '');
      if (opt.length >= 3 && opt.length <= 130) {
        options.push(opt);
      }
    }
  }
  return options.slice(0, 4);
}

function cleanMainPoint(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();

  // Remove leading bullets, numbers, or dashes (e.g. "1. ", "- ", "* ", "• ")
  text = text.replace(/^(\d+[\.\)]|\-|\*|•)\s*/, '');
  // Remove markdown bold / italics
  text = text.replace(/\*\*/g, '').replace(/\*/g, '');

  // Strip LaTeX delimiters \( ... \) and \[ ... \] and $ ... $
  text = text.replace(/\\\(|\\\)/g, '').replace(/\\\[|\\\]/g, '');
  text = text.replace(/\$([^\$]+)\$/g, '$1');
  text = text.replace(/\$/g, '');

  // Replace common LaTeX math commands with clean, elegant Unicode representations
  text = text.replace(/\\theta/gi, 'θ');
  text = text.replace(/\\alpha/gi, 'α');
  text = text.replace(/\\beta/gi, 'β');
  text = text.replace(/\\gamma/gi, 'γ');
  text = text.replace(/\\lambda/gi, 'λ');
  text = text.replace(/\\mu/gi, 'μ');
  text = text.replace(/\\sigma/gi, 'σ');
  text = text.replace(/\\pi/gi, 'π');
  text = text.replace(/\\Delta/gi, 'Δ');
  text = text.replace(/\\nabla/gi, '∇');
  text = text.replace(/\\sum/gi, 'Σ');
  text = text.replace(/\\int/gi, '∫');
  text = text.replace(/\\partial/gi, '∂');
  text = text.replace(/\\infty/gi, '∞');
  text = text.replace(/\\leq|\\le/gi, '≤');
  text = text.replace(/\\geq|\\ge/gi, '≥');
  text = text.replace(/\\neq/gi, '≠');
  text = text.replace(/\\approx/gi, '≈');
  text = text.replace(/\\times/gi, '×');
  text = text.replace(/\\cdot/gi, '·');
  text = text.replace(/\\in\b/g, '∈');
  text = text.replace(/\\to\b|\\rightarrow/gi, '→');
  text = text.replace(/\\sin/gi, 'sin').replace(/\\cos/gi, 'cos').replace(/\\tan/gi, 'tan');
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
  text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  text = text.replace(/\^2\b/g, '²').replace(/\^3\b/g, '³');
  text = text.replace(/\\/g, '');

  // Remove trailing colons or periods
  text = text.replace(/[:]+$/, '').trim();
  return text;
}

function cleanThoughtFromMessageText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Remove closed thought tags: <thought>...</thought>, <think>...</think>, <thinking>...</thinking>
  text = text.replace(/<(thought|think|thinking)>[\s\S]*?<\/\1>/gi, '');

  // 2. Remove unclosed leading thought tag blocks
  // e.g. <thought\n1. Analyze the Request...\n\nHere is...
  text = text.replace(/^<(?:thought|think|thinking)[>\s\n]?[\s\S]*?(?=\n\n(?:#{1,4}\s|```|(?:Here\s+is|Below\s+is|Although\s+this|To\s+(?:understand|solve|explain)|Sure|In\s+this|Let's|The\s+diagram|This\s+diagram)\b)|$)/i, '');

  // 3. Scrub any stray tag remnants
  text = text.replace(/<\/?(?:thought|think|thinking)[^>]*>/gi, '');

  // 4. If message starts with "<thought" on first line
  if (text.startsWith('<thought') || text.startsWith('<think') || text.startsWith('<thinking')) {
    text = text.replace(/^<(?:thought|think|thinking)[^\n]*\n?/i, '');
  }

  return text.trim();
}

export { isDiagramBlock };


function extractArtifactFromResponse(answerText: string, widgets?: any[]): ArtifactItem | null {
  // 1. First priority: Check explicit file widgets
  const fileWidget = widgets?.find((w: any) => w.type === 'files' || w.type === 'file_card');
  if (fileWidget) {
    if (Array.isArray(fileWidget.data) && fileWidget.data.length > 1) {
      const subFiles: ArtifactSubFile[] = fileWidget.data.map((f: any, idx: number) => ({
        id: `file-widget-${idx + 1}-${Date.now()}`,
        title: f.title || f.filepath || `file_${idx + 1}.txt`,
        language: 'text',
        content: f.previewText || `File ready: ${f.title || f.filepath}`,
        type: (f.title || '').endsWith('.docx') ? 'document' : 'code',
      }));
      return {
        id: `art-files-${Date.now()}`,
        title: subFiles[0].title,
        content: subFiles[0].content,
        type: 'file',
        files: subFiles,
      };
    }
    const fileData = Array.isArray(fileWidget.data) ? fileWidget.data[0] : fileWidget.data;
    if (fileData) {
      const filename = fileData.filepath || fileData.title || 'document';
      const cleanTitle = filename.split(/[\\/]/).pop() || filename;
      const isCode = /\.(py|js|ts|tsx|jsx|html|css|json|sql|cpp|c|java|sh|pyw|rs|go|rb|php)$/i.test(cleanTitle);

      let content = fileData.previewText || '';
      if (!content || content.startsWith('File ready:')) {
        const codeBlockMatch = answerText.match(/```(?:[a-zA-Z0-9_\-]+)?[\r\n]([\s\S]+?)```/);
        if (codeBlockMatch) {
          content = codeBlockMatch[1].trim();
        } else {
          content = `File: ${cleanTitle}\n${fileData.description || 'Deliverable ready for download.'}`;
        }
      }

      return {
        id: `art-file-${Date.now()}`,
        title: cleanTitle,
        language: cleanTitle.split('.').pop() || (isCode ? 'python' : 'text'),
        content: content,
        downloadUrl: fileData.downloadUrl,
        type: isCode ? 'code' : 'file',
        sizeBytes: fileData.sizeBytes,
        description: fileData.description,
      };
    }
  }

  // 2. Detect formal letters or sick leave applications in markdown
  const isFormalLetter =
    /(?:To:\s*[\r\n]|Subject:\s*Application|Subject:\s*Leave|Dear\s+(?:Sir|Madam|Mr\.|Ms\.|Dr\.)|Application for Sick Leave)/i.test(answerText);
  if (isFormalLetter) {
    const letterMatch = answerText.match(/((?:To:[\s\S]+?|Subject:[\s\S]+?|Dear\s+[\s\S]+?)(?:Sincerely|Yours obediently|Yours faithfully|Yours sincerely|Regards|Thanking you)[\s\S]*?(?:\n\n[^\n]+)?)/i);
    if (letterMatch) {
      const letterContent = letterMatch[0].trim();
      const isSickLeave = /sick\s*leave/i.test(letterContent);
      return {
        id: `art-doc-${Date.now()}`,
        title: isSickLeave ? 'Sick_Leave_Application.docx' : 'Formal_Application.docx',
        language: 'document',
        content: letterContent,
        type: 'document',
        description: 'Official formatted letter deliverable extracted to side window',
      };
    }
  }

  return null;
}

export default function Chatbot() {
  const [searchParams] = useSearchParams();
  const urlCourseId = searchParams.get('courseId');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Per-course chat history store: courseId -> ChatMessage[]
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('studysync_course_chat_histories');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const cleaned: Record<string, ChatMessage[]> = {};
      for (const [cId, msgs] of Object.entries(parsed)) {
        if (Array.isArray(msgs)) {
          cleaned[cId] = msgs.map((m: any) => ({
            ...m,
            text: cleanThoughtFromMessageText(m.text || ''),
          }));
        }
      }
      return cleaned;
    } catch {
      return {};
    }
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isStreamingActive, setIsStreamingActive] = useState(false);
  const activeStreamCancelRef = useRef<(() => void) | null>(null);
  const [isThinkActive, setIsThinkActive] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [dismissedSuggestionMsgId, setDismissedSuggestionMsgId] = useState<string | null>(null);
  const [readingAloudId, setReadingAloudId] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactItem | null>(null);
  // Attached files & images in input area
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const readyFiles = attachedFiles.filter((f) => f.status === 'ready');
  const isReadingAnyFile = attachedFiles.some((f) => f.status === 'reading');
  // Drag-and-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const equalizerBarsRef = useRef<HTMLDivElement>(null);
  const targetVoiceActionRef = useRef<'send' | 'input'>('send');

  const activeFileReadersRef = useRef<
    Map<string, { reader: FileReader; progressTimer?: any; readyTimeout?: any }>
  >(new Map());

  const handleAttachFiles = (files: File[]) => {
    if (!files || files.length === 0) return;

    const newItems: AttachedFileItem[] = files.map((file) => {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
      const isAud = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|webm|ogg|aac|flac)$/i.test(file.name);
      const isDoc = !isImg && !isAud;

      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        isImage: isImg,
        isAudio: isAud,
        isDoc,
        status: 'reading',
        progress: 15,
      };
    });

    setAttachedFiles((prev) => [...prev, ...newItems]);
    const readingToastId = toast(`Reading ${newItems.length} file${newItems.length > 1 ? 's' : ''}...`, { icon: '⏳' });

    // Read each file asynchronously in browser memory (client-side only; never saved to DB until Enter is pressed)
    newItems.forEach((item) => {
      const reader = new FileReader();

      let currentProg = 20;
      const progressTimer = setInterval(() => {
        // If user already removed/crossed this item, stop immediately
        if (!activeFileReadersRef.current.has(item.id)) {
          clearInterval(progressTimer);
          return;
        }
        currentProg += 25;
        if (currentProg >= 95) {
          clearInterval(progressTimer);
        } else {
          setAttachedFiles((prev) =>
            prev.map((f) => (f.id === item.id && f.status === 'reading' ? { ...f, progress: currentProg } : f))
          );
        }
      }, 100);

      activeFileReadersRef.current.set(item.id, { reader, progressTimer });

      reader.onload = () => {
        clearInterval(progressTimer);
        // If item was removed/crossed while reading, abort completely
        if (!activeFileReadersRef.current.has(item.id)) return;

        let previewUrl: string | undefined = undefined;
        if (item.isImage && typeof reader.result === 'string') {
          previewUrl = reader.result;
        }

        const readyTimeout = setTimeout(() => {
          // If cancelled in the timeout window, abort
          if (!activeFileReadersRef.current.has(item.id)) return;
          activeFileReadersRef.current.delete(item.id);

          setAttachedFiles((prev) => {
            const stillAttached = prev.some((f) => f.id === item.id);
            if (!stillAttached) return prev;
            return prev.map((f) =>
              f.id === item.id
                ? { ...f, status: 'ready', progress: 100, previewUrl }
                : f
            );
          });
          toast.success(`✓ "${item.name}" ready to send (will save to DB only on Enter)`, {
            id: readingToastId,
            duration: 2500,
          });
        }, 300);

        const activeItem = activeFileReadersRef.current.get(item.id);
        if (activeItem) {
          activeItem.readyTimeout = readyTimeout;
        }
      };

      reader.onerror = () => {
        clearInterval(progressTimer);
        activeFileReadersRef.current.delete(item.id);
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: 'error', errorMsg: 'Failed to read file' }
              : f
          )
        );
        toast.error(`Could not read "${item.name}".`);
      };

      if (item.isImage) {
        reader.readAsDataURL(item.file);
      } else {
        reader.readAsArrayBuffer(item.file);
      }
    });
  };

  const handleRemoveAttachment = (id: string) => {
    // 1. Immediately abort active FileReader and clear all timers
    const active = activeFileReadersRef.current.get(id);
    if (active) {
      try {
        active.reader.abort();
      } catch { }
      if (active.progressTimer) clearInterval(active.progressTimer);
      if (active.readyTimeout) clearTimeout(active.readyTimeout);
      activeFileReadersRef.current.delete(id);
    }

    // 2. Remove from attachedFiles and revoke object URL
    setAttachedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });

    // 3. Clear file inputs so selecting the same file works again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';

    toast('Attachment cancelled — will NOT be saved to DB.', { icon: '✕', duration: 2500 });
  };

  const handleClearAllAttachments = () => {
    // Abort all active readers and clear timers
    activeFileReadersRef.current.forEach((active) => {
      try {
        active.reader.abort();
      } catch { }
      if (active.progressTimer) clearInterval(active.progressTimer);
      if (active.readyTimeout) clearTimeout(active.readyTimeout);
    });
    activeFileReadersRef.current.clear();

    attachedFiles.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    toast('All attachments removed — will NOT be saved to DB.', { icon: '🗑️', duration: 2500 });
  };

  const handleDownloadArtifact = (art: ArtifactItem) => {
    if (art.downloadUrl) {
      window.open(art.downloadUrl, '_blank');
      return;
    }
    if (art.files && art.files.length > 0) {
      art.files.forEach((file, index) => {
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
          } catch { }
        }, index * 250);
      });
      toast.success(`Downloading all ${art.files.length} project files!`);
      return;
    }
    try {
      const blob = new Blob([art.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = art.title || 'deliverable.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${art.title}!`);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDownloadSingleSubFile = (sub: ArtifactSubFile) => {
    try {
      const blob = new Blob([sub.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sub.title || 'file.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${sub.title}!`);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleAttachFiles(files);
    }
    e.target.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleAttachFiles(files);
    }
    e.target.value = '';
  };

  // Drag-and-drop handlers for the input form
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleAttachFiles(files);
    }
  };

  // Paste screenshot or files handler (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }

    if (pastedFiles.length > 0) {
      // Prevent browser from inserting raw base64 or filenames into textarea
      e.preventDefault();
      e.stopPropagation();
      handleAttachFiles(pastedFiles);
    }
  };

  const startVoiceRecording = async () => {
    if (!selectedCourse) {
      toast.error('Please select a course first.');
      return;
    }
    if (isReadingAnyFile || isRecordingVoice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Set up Web Audio API Analyser for real-time speech volume responsiveness
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64; // gives 32 frequency bins
          analyser.smoothingTimeConstant = 0.35; // fast, responsive volume changes
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;

          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const timeData = new Uint8Array(analyser.fftSize);

          const updateEqualizer = () => {
            if (!analyserRef.current || !equalizerBarsRef.current) return;
            analyserRef.current.getByteFrequencyData(freqData);
            analyserRef.current.getByteTimeDomainData(timeData);

            // 1. Calculate precise RMS amplitude (waveform volume deviation from 128)
            let sumSquares = 0;
            for (let i = 0; i < timeData.length; i++) {
              const norm = (timeData[i] - 128) / 128;
              sumSquares += norm * norm;
            }
            const rms = Math.sqrt(sumSquares / timeData.length); // 0.0 (silence) to 1.0 (loud)

            const bars = equalizerBarsRef.current.children;
            const numBars = bars.length;

            // Silence threshold: below 0.025 means quiet/not speaking
            const isSilent = rms < 0.025;

            for (let i = 0; i < numBars; i++) {
              const bar = bars[i] as HTMLElement;
              if (!bar) continue;

              if (isSilent) {
                // When silent / quiet: small subtle idle dots (4px - 6px)
                const idleH = 5 + Math.sin(Date.now() / 240 + i * 0.45) * 1.8;
                bar.style.height = `${Math.max(4, idleH).toFixed(1)}px`;
                bar.style.opacity = '0.45';
              } else {
                // When speaking: VOLUME UP! Bars scale up proportionally to user's speech volume!
                const centerDist = Math.abs(i - (numBars - 1) / 2);
                const binIdx = Math.min(
                  freqData.length - 1,
                  Math.floor((centerDist / (numBars / 2)) * (freqData.length * 0.8))
                );
                const freqVal = freqData[binIdx] || (rms * 255);

                // Multiply frequency energy by rms volume level (scales from 6px up to 34px)
                const volumeScale = Math.min(2.2, Math.max(0.4, rms * 9));
                const dynamicH = Math.min(
                  34,
                  Math.max(6, 6 + (freqVal / 255) * 26 * volumeScale)
                );
                bar.style.height = `${dynamicH.toFixed(1)}px`;
                bar.style.opacity = '1';
              }
            }

            animFrameRef.current = requestAnimationFrame(updateEqualizer);
          };

          animFrameRef.current = requestAnimationFrame(updateEqualizer);
        }
      } catch (audioErr) {
        console.warn('AudioContext visualization setup warning:', audioErr);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Clean up audio stream tracks & audio analysis
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try {
            audioContextRef.current.close();
          } catch { }
          audioContextRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());

        const chosenAction = targetVoiceActionRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        setIsRecordingVoice(false);
        setRecordingSeconds(0);

        if (audioBlob.size < 500) {
          toast.error('Recording was too short.');
          return;
        }

        try {
          toast.loading('Transcribing voice note...', { id: 'voice-transcribe' });
          const { data } = await voiceApi.transcribe(audioBlob);
          const transcript = data.data?.transcript?.trim();

          if (!transcript) {
            toast.error('Could not hear speech clearly. Please speak closer to the mic.', {
              id: 'voice-transcribe',
            });
            return;
          }

          if (chosenAction === 'input') {
            // Option 2: Put into input bar for user to edit/review
            setInputMessage((prev) => (prev ? prev.trim() + ' ' + transcript : transcript));
            toast.success('📝 Voice transcribed into input! You can review or edit.', {
              id: 'voice-transcribe',
              duration: 3500,
            });
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
              }
            }, 100);
          } else {
            // Option 1: Direct Enter / Send
            toast.success(
              `🎙️ "${transcript.length > 45 ? transcript.slice(0, 45) + '...' : transcript}"`,
              {
                id: 'voice-transcribe',
                duration: 3000,
              }
            );
            await handleSendVoiceMessage(transcript);
          }
        } catch (err: any) {
          console.error('Voice transcription error:', err);
          toast.error(err.response?.data?.message || 'Voice transcription failed. Please try again.', {
            id: 'voice-transcribe',
          });
        }
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      toast.error('Microphone access denied or not available.');
    }
  };

  const stopVoiceRecording = (mode: 'send' | 'input' = 'send') => {
    targetVoiceActionRef.current = mode;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch { }
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      try {
        mediaRecorderRef.current.stream?.getTracks().forEach((track) => track.stop());
      } catch { }
      try {
        mediaRecorderRef.current.stop();
      } catch { }
    }
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    toast('Voice recording cancelled', { icon: '✕' });
  };

  // Ensure audio analysis and timers are safely terminated on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch { }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
          mediaRecorderRef.current.stop();
        } catch { }
      }
    };
  }, []);

  // Close attachment dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttachMenu]);

  useEffect(() => {
    // Lock window/body scroll so chat layout owns 100% of inner scrolling and input stays sticky
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  useEffect(() => {
    // Auto-focus input bar immediately on load and when switching courses
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedCourse]);

  // Global typing capture: When the user starts typing anywhere on the screen,
  // automatically focus the input bar and start typing smoothly without dropping the first character
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      // If user is already inside an input, textarea, or contentEditable, let normal typing happen
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Ignore modifiers and non-printable control keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' || e.key === 'Tab' || e.key === 'CapsLock') return;
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'PageUp' ||
        e.key === 'PageDown' ||
        e.key === 'Home' ||
        e.key === 'End'
      ) {
        return;
      }

      // If user is currently selecting/highlighting text on the screen, don't hijack
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      // Handle printable character
      if (e.key.length === 1) {
        e.preventDefault();
        if (textareaRef.current) {
          textareaRef.current.focus();
          setInputMessage((prev) => {
            const next = prev + e.key;
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
            }
            return next;
          });
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (textareaRef.current) {
          textareaRef.current.focus();
          setInputMessage((prev) => prev.slice(0, -1));
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Quick reply listener for interactive choice widgets (ask_user_input_v0)
  useEffect(() => {
    const handleQuickReply = (e: Event) => {
      const customEvent = e as CustomEvent<{ value: string; label: string }>;
      if (customEvent.detail?.value) {
        setInputMessage(customEvent.detail.value);
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
        }
      }
    };

    window.addEventListener('chatbot:quick_reply', handleQuickReply);
    return () => {
      window.removeEventListener('chatbot:quick_reply', handleQuickReply);
    };
  }, []);

  // Listen for artifact open events dispatched from code blocks or file widgets
  useEffect(() => {
    const handleOpenArtifact = (e: Event) => {
      const customEvent = e as CustomEvent<ArtifactItem>;
      if (customEvent.detail) {
        setActiveArtifact(customEvent.detail);
      }
    };

    window.addEventListener('studysync:open-artifact', handleOpenArtifact);
    return () => {
      window.removeEventListener('studysync:open-artifact', handleOpenArtifact);
    };
  }, []);

  useEffect(() => {
    fetchCourses();
  }, []);

  // Save histories to localStorage (skip writes during rapid streaming ticks)
  useEffect(() => {
    if (isStreamingActive) return;
    try {
      localStorage.setItem('studysync_course_chat_histories', JSON.stringify(histories));
    } catch { }
  }, [histories, isStreamingActive]);

  // Cancel any active stream when course changes or unmounts
  useEffect(() => {
    return () => {
      if (activeStreamCancelRef.current) {
        activeStreamCancelRef.current();
      }
    };
  }, [selectedCourse]);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedCourse, histories, isSending]);

  // Whenever URL param courseId changes, immediately switch to that course
  useEffect(() => {
    if (courses.length > 0 && urlCourseId) {
      const target = courses.find((c: Course) => c.id === urlCourseId);
      if (target && (!selectedCourse || selectedCourse.id !== target.id)) {
        handleSelectCourse(target);
      }
    }
  }, [urlCourseId, courses]);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const { data } = await coursesApi.getAll();
      const list = data.data?.courses || [];
      setCourses(list);
      if (list.length > 0) {
        const targetId = urlCourseId || localStorage.getItem('studysync_last_selected_course');
        const found = list.find((c: Course) => c.id === targetId) || list[0];
        handleSelectCourse(found);
      }
    } catch {
      toast.error('Failed to load courses.');
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setShowCourseDropdown(false);
    localStorage.setItem('studysync_last_selected_course', course.id);

    try {
      const { data } = await coursesApi.getChatHistory(course.id);
      if (data.data?.history !== undefined) {
        setHistories((prev) => ({
          ...prev,
          [course.id]: data.data.history,
        }));
      }
    } catch { }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleCopyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleReadAloud = (msgId: string, text: string) => {
    if (readingAloudId === msgId) {
      // Stop reading
      window.speechSynthesis.cancel();
      setReadingAloudId(null);
      return;
    }
    // Stop any previous
    window.speechSynthesis.cancel();
    // Clean markdown/latex for speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
      .replace(/\$\$[\s\S]+?\$\$/g, ' math formula ')
      .replace(/\$[^$]+\$/g, ' math expression ')
      .replace(/\\\([\s\S]+?\\\)/g, ' math expression ')
      .replace(/\\\[[\s\S]+?\\\]/g, ' math formula ')
      .replace(/[#*_~>|\-]+/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.onend = () => setReadingAloudId(null);
    utterance.onerror = () => setReadingAloudId(null);
    setReadingAloudId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleViewSources = (_msgId: string, sources?: SourceItem[]) => {
    if (!sources || sources.length === 0) {
      toast('No sources were used for this response.', { icon: 'ℹ️' });
      return;
    }

    const subFiles: ArtifactSubFile[] = sources.map((src, idx) => {
      const fileName = src.filename || `Source_${idx + 1}.txt`;
      const matchPct = Math.round(src.score * 100);
      return {
        id: `src-sub-${idx + 1}-${Date.now()}`,
        title: `Source ${idx + 1}`,
        language: 'markdown',
        type: 'document',
        content: `### 📄 ${fileName}\n\n**Relevance:** ${matchPct}% match\n\n---\n\n${src.text}`,
        description: `${matchPct}% match • ${fileName}`,
      };
    });

    const sourcesArtifact: ArtifactItem = {
      id: `sources-artifact-${Date.now()}`,
      title: `Sources (${sources.length})`,
      language: 'markdown',
      content: subFiles[0].content,
      type: 'document',
      files: subFiles.length > 1 ? subFiles : undefined,
      description: `${sources.length} citations from course materials`,
    };

    setActiveArtifact(sourcesArtifact);
    toast.success(`Opened ${sources.length} sources in right-side window`, { icon: '📚' });
  };



  // ─── Word-by-Word High-Speed Streamer with Flash Indicator ─────────────
  const stopStreaming = () => {
    if (activeStreamCancelRef.current) {
      activeStreamCancelRef.current();
    }
  };

  const streamAssistantMessage = (
    courseId: string,
    assistantMsgId: string,
    fullText: string,
    baseMsg: Omit<ChatMessage, 'text' | 'isStreaming'>,
    onComplete?: () => void
  ) => {
    // If another stream is running, finish it immediately
    if (activeStreamCancelRef.current) {
      activeStreamCancelRef.current();
    }

    const cleanText = cleanThoughtFromMessageText(fullText || '');
    if (!cleanText) {
      setHistories((prev) => {
        const existing = prev[courseId] || [];
        const next = [...existing, { ...baseMsg, text: '', isStreaming: false }];
        try {
          localStorage.setItem('studysync_course_chat_histories', JSON.stringify({ ...prev, [courseId]: next }));
        } catch {}
        return { ...prev, [courseId]: next };
      });
      setIsSending(false);
      setIsStreamingActive(false);
      if (onComplete) onComplete();
      return;
    }

    // Split words and whitespace tokens preserving exact formatting, math, and code blocks
    const tokens = cleanText.match(/\S+\s*|\s+/g) || [cleanText];
    const totalTokens = tokens.length;

    // Word-by-word streaming with flash blur animation & slow-mo pacing:
    // Pacing based on user request ("output thora slow ay animation thori achi paragraph flash huy blur slowmo")
    // Keep 1 token per tick always so words don't jump or skip
    let currentIndex = 0;
    let currentText = '';

    setIsStreamingActive(true);
    setIsSending(false); // Switch from spinner to active streaming with stop button

    // Insert initial streaming message
    setHistories((prev) => {
      const existing = prev[courseId] || [];
      const filtered = existing.filter((m) => m.id !== assistantMsgId);
      return {
        ...prev,
        [courseId]: [
          ...filtered,
          {
            ...baseMsg,
            text: '',
            isStreaming: true,
          },
        ],
      };
    });

    let isCancelled = false;
    let timeoutId: any = null;

    const finalize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      activeStreamCancelRef.current = null;
      setIsStreamingActive(false);

      setHistories((prev) => {
        const existing = prev[courseId] || [];
        const next = existing.map((m) =>
          m.id === assistantMsgId ? { ...m, text: cleanText, isStreaming: false } : m
        );
        try {
          localStorage.setItem('studysync_course_chat_histories', JSON.stringify({ ...prev, [courseId]: next }));
        } catch {}
        return {
          ...prev,
          [courseId]: next,
        };
      });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      if (onComplete) onComplete();
    };

    activeStreamCancelRef.current = () => {
      isCancelled = true;
      finalize();
    };

    const stepToken = () => {
      if (isCancelled) return;

      currentIndex = Math.min(totalTokens, currentIndex + 1);
      currentText = tokens.slice(0, currentIndex).join('');

      setHistories((prev) => {
        const existing = prev[courseId] || [];
        return {
          ...prev,
          [courseId]: existing.map((m) =>
            m.id === assistantMsgId ? { ...m, text: currentText, isStreaming: true } : m
          ),
        };
      });

      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      if (currentIndex >= totalTokens) {
        finalize();
        return;
      }

      // Calculate next token delay for natural, cinematic slow-mo pacing
      const currentTok = tokens[currentIndex - 1] || '';
      // Base slowmo pace: 70ms - 84ms per word
      let nextDelay = totalTokens < 90 ? 84 : totalTokens < 250 ? 76 : 68;

      // Organic pauses for paragraphs and punctuation
      if (currentTok.includes('\n\n')) {
        nextDelay += 130; // Distinct paragraph pause so user sees the paragraph flash & blur entrance
      } else if (currentTok.includes('\n')) {
        nextDelay += 75; // Line-break pause
      } else if (currentTok.endsWith('.') || currentTok.endsWith('?') || currentTok.endsWith('!')) {
        nextDelay += 65; // Sentence cadence pause
      } else if (currentTok.endsWith(',') || currentTok.endsWith(':') || currentTok.endsWith(';')) {
        nextDelay += 35; // Sub-clause pause
      }

      timeoutId = setTimeout(stepToken, nextDelay);
    };

    // Kick off streaming loop
    timeoutId = setTimeout(stepToken, 70);
  };

  const handleSaveAndSubmitEdit = async (messageId: string) => {
    if (!selectedCourse || !editingText.trim() || isSending) return;
    const courseId = selectedCourse.id;
    const currentHist = histories[courseId] || [];

    const msgIndex = currentHist.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // Slice history up to this message (discard this message and subsequent turns, just like ChatGPT)
    const priorHistory = currentHist.slice(0, msgIndex);
    const targetMsg = currentHist[msgIndex];
    const newQuery = editingText.trim();

    // Create updated user message
    const updatedUserMsg: ChatMessage = {
      ...targetMsg,
      id: crypto.randomUUID(),
      text: newQuery,
      timestamp: new Date().toISOString(),
    };

    setHistories((prev) => ({
      ...prev,
      [courseId]: [...priorHistory, updatedUserMsg],
    }));

    setEditingMessageId(null);
    setEditingText('');
    setIsSending(true);

    const editStartTime = Date.now();
    try {
      const { data } = await coursesApi.askChat(courseId, newQuery, [], isThinkActive);
      const editElapsedSeconds = Math.max(1, Math.round((Date.now() - editStartTime) / 1000));

      if (data.data?.createdTasks && Array.isArray(data.data.createdTasks) && data.data.createdTasks.length > 0) {
        data.data.createdTasks.forEach((t: any) => {
          toast.success(`📅 Auto-Scheduled ${t.type.toUpperCase()}: "${t.title}"`, { duration: 5000 });
        });
      }

      const extractedArtifact = extractArtifactFromResponse(data.data?.answer || '', data.data?.widgets);

      const assistantMsgId = crypto.randomUUID();
      const baseAssistantMsg = {
        id: assistantMsgId,
        courseId,
        role: 'assistant' as const,
        sources: data.data.sources || [],
        widgets: data.data.widgets || undefined,
        toolCalls: data.data.toolCalls || undefined,
        thought: data.data.thought || undefined,
        thoughtDurationSeconds: editElapsedSeconds,
        timestamp: new Date().toISOString(),
        artifact: extractedArtifact || undefined,
      };

      streamAssistantMessage(courseId, assistantMsgId, data.data.answer || '', baseAssistantMsg, () => {
        // Side window opens strictly when an actual file deliverable widget exists from backend
        if (extractedArtifact && (data.data?.widgets?.some((w: any) => w.type === 'files' || w.type === 'file_card'))) {
          setTimeout(() => {
            setActiveArtifact(extractedArtifact);
          }, 350);
        }
      });
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        courseId,
        role: 'assistant',
        text: 'Sorry, could not generate a response for your edited message.',
        timestamp: new Date().toISOString(),
      };
      setHistories((prev) => ({
        ...prev,
        [courseId]: [...priorHistory, updatedUserMsg, errorMsg],
      }));
    } finally {
      setIsSending(false);
    }
  };


  const handleSendMessage = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : inputMessage).trim();

    if (isReadingAnyFile) {
      toast('Reading file in progress... Please wait until reading completes before sending.', { icon: '⏳' });
      return;
    }

    // Strictly check files that are currently ready in attachedFiles
    const currentFiles = attachedFiles.filter((f) => f.status === 'ready');
    if ((!query && currentFiles.length === 0) || !selectedCourse || isSending) return;

    const courseId = selectedCourse.id;
    const filesToSend = currentFiles.map((item) => item.file);
    const previewUrls = currentFiles
      .filter((item) => item.isImage && item.previewUrl)
      .map((item) => item.previewUrl!);

    let displayQuery = query;
    if (!displayQuery) {
      displayQuery =
        currentFiles.length > 1
          ? `📎 ${currentFiles.length} attached files: ${currentFiles.map((f) => f.name).join(', ')}`
          : currentFiles.length === 1
            ? `📎 ${currentFiles[0].name}`
            : '';
    }

    // Append user message immediately with image previews and attached files
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      courseId,
      role: 'user',
      text: displayQuery,
      imageUrl: previewUrls[0] || undefined,
      imageUrls: previewUrls.length > 0 ? previewUrls : undefined,
      attachedFiles: currentFiles.map((c) => ({
        name: c.name,
        type: c.type,
        size: c.size,
        previewUrl: c.previewUrl,
      })),
      timestamp: new Date().toISOString(),
    };

    setHistories((prev) => ({
      ...prev,
      [courseId]: [...(prev[courseId] || []), userMsg],
    }));

    if (!customQuery || customQuery === inputMessage.trim()) {
      setInputMessage('');
    }
    setAttachedFiles([]);
    setDismissedSuggestionMsgId(null);
    activeFileReadersRef.current.clear();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsSending(true);

    const sendStartTime = Date.now();
    try {
      const { data } = await coursesApi.askChat(courseId, query, filesToSend, isThinkActive);
      const sendElapsedSeconds = Math.max(1, Math.round((Date.now() - sendStartTime) / 1000));

      if (data.data?.createdTasks && Array.isArray(data.data.createdTasks) && data.data.createdTasks.length > 0) {
        data.data.createdTasks.forEach((t: any) => {
          toast.success(`📅 Auto-Scheduled ${t.type.toUpperCase()}: "${t.title}"`, { duration: 5000 });
        });
      }
      if (data.data?.discardedTasks && Array.isArray(data.data.discardedTasks) && data.data.discardedTasks.length > 0) {
        data.data.discardedTasks.forEach((t: any) => {
          toast(`ℹ️ "${t.title}" already exists on your schedule.`, { icon: '🗓️', duration: 4000 });
        });
      }

      const extractedArtifact = extractArtifactFromResponse(data.data?.answer || '', data.data?.widgets);

      const assistantMsgId = crypto.randomUUID();
      const baseAssistantMsg = {
        id: assistantMsgId,
        courseId,
        role: 'assistant' as const,
        sources: data.data.sources || [],
        widgets: data.data.widgets || undefined,
        toolCalls: data.data.toolCalls || undefined,
        thought: data.data.thought || undefined,
        thoughtDurationSeconds: sendElapsedSeconds,
        timestamp: new Date().toISOString(),
        artifact: extractedArtifact || undefined,
      };

      streamAssistantMessage(courseId, assistantMsgId, data.data?.answer || '', baseAssistantMsg, () => {
        // Side window opens strictly when an actual file deliverable widget exists from backend
        if (extractedArtifact && (data.data?.widgets?.some((w: any) => w.type === 'files' || w.type === 'file_card'))) {
          setTimeout(() => {
            setActiveArtifact(extractedArtifact);
          }, 350);
        }
      });
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        courseId,
        role: 'assistant',
        text: 'Sorry, could not generate a response. Please check your image or notes and try again.',
        timestamp: new Date().toISOString(),
      };
      setHistories((prev) => ({
        ...prev,
        [courseId]: [...(prev[courseId] || []), errorMsg],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleSendVoiceMessage = async (transcript: string) => {
    if (!transcript.trim() || !selectedCourse || isSending) return;
    const courseId = selectedCourse.id;
    const spokenText = transcript.trim();

    // Append user voice message with mic indicator
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      courseId,
      role: 'user',
      text: spokenText,
      timestamp: new Date().toISOString(),
    };

    setHistories((prev) => ({
      ...prev,
      [courseId]: [...(prev[courseId] || []), userMsg],
    }));

    setIsSending(true);

    try {
      const { data } = await coursesApi.askChat(courseId, spokenText, [], isThinkActive);

      if (data.data?.createdTasks && Array.isArray(data.data.createdTasks) && data.data.createdTasks.length > 0) {
        data.data.createdTasks.forEach((t: any) => {
          toast.success(`📅 Auto-Scheduled ${t.type.toUpperCase()}: "${t.title}"`, { duration: 5000 });
        });
      }
      if (data.data?.discardedTasks && Array.isArray(data.data.discardedTasks) && data.data.discardedTasks.length > 0) {
        data.data.discardedTasks.forEach((t: any) => {
          toast(`ℹ️ "${t.title}" already exists on your schedule.`, { icon: '🗓️', duration: 4000 });
        });
      }

      const assistantMsgId = crypto.randomUUID();
      const baseAssistantMsg = {
        id: assistantMsgId,
        courseId,
        role: 'assistant' as const,
        sources: data.data.sources || [],
        widgets: data.data.widgets || undefined,
        toolCalls: data.data.toolCalls || undefined,
        timestamp: new Date().toISOString(),
      };

      streamAssistantMessage(courseId, assistantMsgId, data.data.answer || '', baseAssistantMsg);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        courseId,
        role: 'assistant',
        text: 'Sorry, could not process your voice command. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setHistories((prev) => ({
        ...prev,
        [courseId]: [...(prev[courseId] || []), errorMsg],
      }));
    } finally {
      setIsSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!selectedCourse) return;
    const courseId = selectedCourse.id;

    try {
      await coursesApi.clearChatHistory(courseId);
    } catch { }

    setHistories((prev) => ({
      ...prev,
      [courseId]: [],
    }));
    toast.success('Started a new chat session.');
  };

  const currentMessages = selectedCourse ? histories[selectedCourse.id] || [] : [];
  const latestMessage = currentMessages[currentMessages.length - 1];

  const activeSuggestions = useMemo(() => {
    if (!latestMessage || latestMessage.role !== 'assistant') return [];
    if (dismissedSuggestionMsgId === latestMessage.id) return [];
    return parseClarificationOptions(latestMessage.text);
  }, [latestMessage, dismissedSuggestionMsgId]);

  const handleSuggestionChipClick = (suggestionText: string) => {
    const textToSend = suggestionText.trim();
    if (!textToSend || isSending) return;
    if (latestMessage) {
      setDismissedSuggestionMsgId(latestMessage.id);
    }
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    handleSendMessage(undefined, textToSend);
  };

  if (loadingCourses) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: 12,
          color: 'var(--text-muted)',
        }}
      >
        <Loader2 size={26} className="spin-animate" color="#6366F1" />
        <span style={{ fontSize: '0.9rem' }}>Loading StudySync AI...</span>
      </div>
    );
  }

  // If user has zero courses yet
  if (courses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
        <h3>No courses found</h3>
        <p style={{ marginTop: 8, fontSize: '0.9rem' }}>Please create a course first in the Courses section.</p>
        <a href="/courses" className="btn btn-primary" style={{ marginTop: 16 }}>
          Go to Courses
        </a>
      </div>
    );
  }

  return (
    <div className={`chatbot-fullpage chatgpt-layout ${activeArtifact ? 'has-artifact-open' : ''} ${currentMessages.length === 0 ? 'no-messages' : ''}`}>
      {/* ChatGPT Sleek Topbar */}
      <div className="chatgpt-topbar">
        {/* Model / Course Selector Dropdown Pill */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="chatgpt-model-pill"
            onClick={() => setShowCourseDropdown(!showCourseDropdown)}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: selectedCourse?.colorTag || '#6366F1',
              }}
            />
            <span>{selectedCourse ? selectedCourse.name : 'Select Course'}</span>
            <ChevronDown size={14} color="#6B7280" />
          </button>

          {showCourseDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                zIndex: 100,
                minWidth: 240,
                padding: '6px',
                overflow: 'hidden',
              }}
            >
              {courses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => handleSelectCourse(c)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    background: selectedCourse?.id === c.id ? '#F3F4F6' : '#FFFFFF',
                    color: '#111827',
                    fontWeight: selectedCourse?.id === c.id ? 600 : 400,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = selectedCourse?.id === c.id ? '#F3F4F6' : '#FFFFFF')
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: c.colorTag || '#6366F1',
                      }}
                    />
                    <span>{c.name}</span>
                  </div>
                  {selectedCourse?.id === c.id && <Check size={14} color="#6366F1" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topbar Right Actions: Upload Notes & New Chat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isReadingAnyFile || !selectedCourse}
            title="Attach notes or study files to this chat (saved to DB only when you press Enter)"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 500,
              color: '#374151',
              cursor: isReadingAnyFile ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
          >
            {isReadingAnyFile ? (
              <>
                <Loader2 size={13} className="spin-animate" color="#6366F1" />
                <span>Reading File...</span>
              </>
            ) : (
              <>
                <UploadCloud size={14} color="#6B7280" />
                <span>Attach Notes</span>
              </>
            )}
          </button>

          {currentMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="Start a fresh chat session"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.82rem',
                color: '#6B7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FEE2E2';
                e.currentTarget.style.color = '#EF4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6B7280';
              }}
            >
              <RotateCcw size={14} />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Split: Left Chat Column + Right Artifact Panel */}
      <div className="chatbot-workspace-split">
        <div className="chatbot-chat-column">
          {/* Main ChatGPT Centered Chat Column */}
          <div
            className="chatgpt-scroll-container"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (
                !target.closest('button') &&
                !target.closest('a') &&
                !target.closest('input') &&
                !target.closest('textarea') &&
                !window.getSelection()?.toString()
              ) {
                textareaRef.current?.focus();
              }
            }}
          >
            <div className="chatgpt-centered-column">
              {/* Messages area: only rendered when there ARE messages */}
              {currentMessages.length === 0 ? null : (
                currentMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  if (isUser) {
                    const isEditing = editingMessageId === msg.id;

                    if (isEditing) {
                      return (
                        <div key={msg.id} className="chatgpt-user-row">
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '82%',
                              background: '#F4F4F4',
                              borderRadius: '20px',
                              padding: '14px 16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              border: '1px solid #E5E7EB',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            }}
                          >
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              autoFocus
                              rows={Math.min(8, Math.max(2, editingText.split('\n').length))}
                              style={{
                                width: '100%',
                                background: '#FFFFFF',
                                border: '1px solid #D1D5DB',
                                borderRadius: '12px',
                                padding: '10px 14px',
                                fontSize: '0.94rem',
                                lineHeight: 1.55,
                                resize: 'none',
                                outline: 'none',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box',
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveAndSubmitEdit(msg.id);
                                }
                                if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                }
                              }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => setEditingMessageId(null)}
                                style={{
                                  background: '#FFFFFF',
                                  border: '1px solid #D1D5DB',
                                  borderRadius: '20px',
                                  padding: '6px 14px',
                                  fontSize: '0.82rem',
                                  fontWeight: 500,
                                  color: '#374151',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveAndSubmitEdit(msg.id)}
                                disabled={!editingText.trim() || isSending}
                                style={{
                                  background: '#0D0D0D',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: '20px',
                                  padding: '6px 16px',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: !editingText.trim() || isSending ? 'not-allowed' : 'pointer',
                                  opacity: !editingText.trim() || isSending ? 0.6 : 1,
                                }}
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%', gap: 4 }}>
                        <div className="chatgpt-user-row">
                          <div className="chatgpt-user-bubble">
                            {/* Multiple Attached Images Gallery */}
                            {((msg.imageUrls && msg.imageUrls.length > 0) || msg.imageUrl) && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                  marginBottom: msg.text ? 10 : 0,
                                }}
                              >
                                {(msg.imageUrls && msg.imageUrls.length > 0 ? msg.imageUrls : [msg.imageUrl!]).map(
                                  (url, idx) => (
                                    <img
                                      key={idx}
                                      src={url}
                                      alt={`Attachment ${idx + 1}`}
                                      style={{
                                        maxWidth: msg.imageUrls && msg.imageUrls.length > 1 ? '160px' : '280px',
                                        maxHeight: '160px',
                                        borderRadius: '12px',
                                        objectFit: 'cover',
                                        cursor: 'pointer',
                                        border: '1px solid #E5E7EB',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                        transition: 'transform 0.15s ease',
                                      }}
                                      onClick={() => window.open(url, '_blank')}
                                      title="Click to view full size"
                                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                    />
                                  )
                                )}
                              </div>
                            )}

                            {/* Attached Non-Image Documents & Audio Chips */}
                            {msg.attachedFiles &&
                              msg.attachedFiles.filter((af) => !af.type?.startsWith('image/')).length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                    marginBottom: msg.text ? 8 : 0,
                                  }}
                                >
                                  {msg.attachedFiles
                                    .filter((af) => !af.type?.startsWith('image/'))
                                    .map((af, idx) => {
                                      const badge = getFileBadgeInfo(af.name, af.type || '');
                                      return (
                                        <div
                                          key={idx}
                                          className="chatgpt-msg-doc-card"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toast(`Attached document: "${af.name}" indexed for AI context.`, {
                                              icon: '📄',
                                            });
                                          }}
                                          title={`Attached file: ${af.name}`}
                                        >
                                          <div
                                            className="chatgpt-msg-doc-badge"
                                            style={{
                                              background: badge.bg,
                                              color: badge.color,
                                              border: `1px solid ${badge.border}`,
                                            }}
                                          >
                                            {badge.label}
                                          </div>
                                          <span className="chatgpt-msg-doc-name">{af.name}</span>
                                        </div>
                                      );
                                    })}
                                </div>
                              )}

                            <div>{msg.text}</div>
                          </div>
                        </div>

                        {/* ChatGPT User Action Bar: Edit & Copy */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            paddingRight: 6,
                          }}
                        >
                          <button
                            type="button"
                            className="chatgpt-icon-btn"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditingText(msg.text);
                            }}
                            title="Edit message"
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="chatgpt-icon-btn"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            title="Copy message"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check size={13} color="#10B981" />
                                <span style={{ color: '#10B981', fontWeight: 500 }}>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Assistant message
                  // Strip redundant download links from text when download widget card exists
                  const hasFileWidget = msg.widgets?.some((w: any) => w.type === 'files' || w.type === 'file_card');
                  let displayText = cleanThoughtFromMessageText(msg.text);
                  if (hasFileWidget) {
                    displayText = displayText
                      // Remove markdown links containing /api/courses/ or download URLs
                      .replace(/\[([^\]]*)\]\(https?:\/\/[^)]*\/api\/courses\/[^)]*\)/gi, '')
                      .replace(/\[([^\]]*)\]\(\/api\/courses\/[^)]*\)/gi, '')
                      // Remove "Download <filename>" standalone links
                      .replace(/\[(?:Download|⬇️?\s*Download)\s+[^\]]+\]\([^)]+\)/gi, '')
                      // Remove lines like "The download link is below:" or "Download link:"
                      .replace(/^.*(?:download link|download the file|click.*download|1-click download).*$/gim, '')
                      // Clean up multiple blank lines left behind
                      .replace(/\n{3,}/g, '\n\n')
                      .trim();
                  }

                  // Keep all text, math formulas, code blocks, and diagrams inline in the chat flow
                  const artifactForMsg = msg.artifact || (extractArtifactFromResponse(msg.text, msg.widgets) || undefined);

                  return (
                    <div key={msg.id} className="chatgpt-assistant-row">
                      {/* Clean Simple Thinking Process Block */}
                      <ThinkingBlock thought={msg.thought} durationSeconds={msg.thoughtDurationSeconds} toolCalls={msg.toolCalls} sources={msg.sources} />

                      <div className="chatgpt-assistant-content">
                        <div className="chatgpt-streaming-wrapper">
                          <MarkdownView content={displayText} isStreaming={msg.isStreaming} />
                        </div>
                      </div>

                      {/* Clean Minimal Deliverable Card (Rendered only for formal documents/deliverables, never for inline code) */}
                      {artifactForMsg && !msg.isStreaming && !hasFileWidget && artifactForMsg.type !== 'code' && (
                        artifactForMsg.files && artifactForMsg.files.length > 1 ? (
                          <div className="chat-artifact-grid-2col">
                            {artifactForMsg.files.map((file, idx) => (
                              <div
                                key={file.id || idx}
                                className="chat-artifact-ref-card"
                                onClick={() =>
                                  setActiveArtifact({
                                    ...artifactForMsg,
                                    title: file.title,
                                    content: file.content,
                                    language: file.language,
                                    type: file.type || 'code',
                                  })
                                }
                                title={`Click to view ${file.title} in side window`}
                              >
                                <div className="chat-artifact-ref-left">
                                  <div className="chat-artifact-ref-icon">
                                    {file.type === 'document' || file.title.endsWith('.docx') ? (
                                      <FileText size={15} />
                                    ) : (
                                      <FileCode size={15} />
                                    )}
                                  </div>
                                  <span className="chat-artifact-ref-title" title={file.title}>
                                    {file.title}
                                  </span>
                                </div>

                                <div className="chat-artifact-ref-actions">
                                  <button
                                    type="button"
                                    className="chat-artifact-btn-download"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadSingleSubFile(file);
                                    }}
                                    title={`Download ${file.title}`}
                                  >
                                    <Download size={13} />
                                    <span>Download</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="chat-artifact-btn-open"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveArtifact({
                                        ...artifactForMsg,
                                        title: file.title,
                                        content: file.content,
                                        language: file.language,
                                        type: file.type || 'code',
                                      });
                                    }}
                                    title="Open in side window"
                                  >
                                    <span>Open</span>
                                    <ArrowUpRight size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div
                            className="chat-artifact-ref-card"
                            onClick={() => setActiveArtifact(artifactForMsg)}
                            title="Click to view file in side window"
                          >
                            <div className="chat-artifact-ref-left">
                              <div className="chat-artifact-ref-icon">
                                {artifactForMsg.type === 'document' ? (
                                  <FileText size={16} />
                                ) : (
                                  <FileCode size={16} />
                                )}
                              </div>
                              <span className="chat-artifact-ref-title">{artifactForMsg.title}</span>
                              {artifactForMsg.sizeBytes ? (
                                <span className="chat-artifact-ref-size">
                                  ({Math.round(artifactForMsg.sizeBytes / 1024) || 1} KB)
                                </span>
                              ) : null}
                            </div>

                            <div className="chat-artifact-ref-actions">
                              <button
                                type="button"
                                className="chat-artifact-btn-download"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadArtifact(artifactForMsg);
                                }}
                                title="Download file"
                              >
                                <Download size={13} />
                                <span>Download</span>
                              </button>
                              <button
                                type="button"
                                className="chat-artifact-btn-open"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveArtifact(artifactForMsg);
                                }}
                                title="Open in side window"
                              >
                                <span>Open</span>
                                <ArrowUpRight size={13} />
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      {/* Interactive Visual Widgets */}
                      {msg.widgets && msg.widgets.length > 0 && !msg.isStreaming && (
                        <WidgetRenderer widgets={msg.widgets} />
                      )}

                      {/* Assistant Action Bar */}
                      {!msg.isStreaming && (
                        <div className="chatgpt-assistant-actions">
                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          title="Copy response to clipboard"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check size={14} color="#10B981" />
                              <span style={{ color: '#10B981', fontWeight: 500 }}>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={14} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          className="chatgpt-icon-btn"
                          onClick={() => handleReadAloud(msg.id, msg.text)}
                          title={readingAloudId === msg.id ? 'Stop reading' : 'Read aloud'}
                        >
                          {readingAloudId === msg.id ? (
                            <>
                              <VolumeX size={14} color="#EF4444" />
                              <span style={{ color: '#EF4444' }}>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={14} />
                              <span>Read aloud</span>
                            </>
                          )}
                        </button>

                        {msg.sources && msg.sources.length > 0 && (
                          <button
                            type="button"
                            className="chatgpt-icon-btn"
                            onClick={() => handleViewSources(msg.id, msg.sources)}
                            title="View knowledge sources in right-side window"
                          >
                            <Eye size={14} color="#6366F1" />
                            <span>Sources ({msg.sources.length})</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
                })
              )}

              {/* Progressive Animated Thinking Indicator */}
              {isSending && (
                <div className="chatgpt-assistant-row">
                  <LiveThinkingIndicator courseColor={selectedCourse?.colorTag || '#6366F1'} />
                </div>
              )}

              {/* Bottom clearance spacer so last message is never covered by floating input bar */}
              <div style={{ height: 130, minHeight: 130, flexShrink: 0 }} />
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating Bottom ChatGPT Input Area */}
          <div className="chatgpt-floating-bottom">
            <div className="chatgpt-floating-inner">

              {/* ── Welcome Header (centered, shown above input when no messages) ── */}
              {currentMessages.length === 0 && (
                <div className="chatgpt-welcome-centered">
                  <img
                    src="/studysync-emblem-transparent.png"
                    alt="StudySync AI"
                    style={{
                      width: 82,
                      height: 82,
                      objectFit: 'contain',
                      marginBottom: 14,
                      filter: 'drop-shadow(0 10px 26px rgba(99, 102, 241, 0.45))',
                      userSelect: 'none',
                    }}
                  />
                  <h2 className="chatgpt-welcome-heading">What can I help with today?</h2>
                  {selectedCourse && (
                    <div className="chatgpt-course-chip">
                      <span className="chip-dot" style={{ backgroundColor: selectedCourse.colorTag || '#4F46E5' }} />
                      <span>{selectedCourse.name}</span>
                    </div>
                  )}
                </div>
              )}


              {/* Attached Files & Images Preview Strip (Reading / Ready State) */}
              {attachedFiles.length > 0 && (
                <div className="chatgpt-thumb-strip">
                  {attachedFiles.map((item) => {
                    const badge = getFileBadgeInfo(item.name, item.type);
                    const isReading = item.status === 'reading';

                    if (item.isImage && item.previewUrl) {
                      return (
                        <div
                          key={item.id}
                          className={`chatgpt-thumb-item ${isReading ? 'reading' : 'ready'}`}
                          style={{
                            borderColor: isReading ? '#93C5FD' : '#A7F3D0',
                            background: isReading ? '#F8FAFC' : '#F0FDF4',
                          }}
                        >
                          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                            />
                            {isReading && (
                              <div
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.45)',
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Loader2 size={15} className="spin-animate" color="#FFFFFF" />
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 120 }}>
                            <span
                              style={{
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                color: '#111827',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {isReading ? (
                                <span style={{ fontSize: '0.68rem', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span className="pulse-dot" />
                                  Reading {item.progress}%
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: '#059669', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Check size={10} strokeWidth={3} />
                                  Ready • {(item.size / 1024).toFixed(0)} KB
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="chatgpt-thumb-close"
                            onClick={() => handleRemoveAttachment(item.id)}
                            title="Remove image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    }

                    // Document / Audio File Chip
                    return (
                      <div
                        key={item.id}
                        className={`chatgpt-doc-thumb ${isReading ? 'reading' : 'ready'}`}
                        title={item.name}
                      >
                        <div
                          className="chatgpt-doc-badge"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {isReading ? (
                            <Loader2 size={15} className="spin-animate" />
                          ) : item.isAudio ? (
                            <FileAudio size={15} />
                          ) : (
                            <FileText size={15} />
                          )}
                        </div>

                        <div className="chatgpt-doc-info">
                          <span className="chatgpt-doc-name">{item.name}</span>
                          <div className="chatgpt-doc-status">
                            {isReading ? (
                              <span style={{ color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span className="pulse-dot" />
                                Reading {item.progress}%...
                              </span>
                            ) : item.status === 'error' ? (
                              <span style={{ color: '#EF4444' }}>Read error</span>
                            ) : (
                              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Check size={11} strokeWidth={3} />
                                Ready to send • {(item.size / 1024).toFixed(0)} KB
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="chatgpt-thumb-close"
                          onClick={() => handleRemoveAttachment(item.id)}
                          title="Remove file"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px dashed #D1D5DB',
                      background: '#FFFFFF',
                      color: '#4F46E5',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title="Attach another file or image"
                  >
                    <Plus size={13} />
                    <span>Add more</span>
                  </button>

                  {attachedFiles.length > 1 && (
                    <button
                      type="button"
                      onClick={handleClearAllAttachments}
                      style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        fontSize: '0.76rem',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        fontWeight: 600,
                      }}
                    >
                      Clear all ({attachedFiles.length})
                    </button>
                  )}
                </div>
              )}

              {/* 1-Column Main Point Suggestions */}
              {activeSuggestions.length > 0 && (
                <div className="claude-input-suggestions-column">
                  <div className="claude-suggestions-header">
                    <div className="claude-suggestions-label">
                      <Sparkles size={13} className="claude-sparkle-icon" />
                      <span>Suggested follow-ups:</span>
                    </div>
                    <button
                      type="button"
                      className="claude-suggestions-close"
                      onClick={() => setDismissedSuggestionMsgId(latestMessage?.id || 'dismissed')}
                      title="Dismiss suggestions"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="claude-suggestions-list-1col">
                    {activeSuggestions.map((opt, idx) => {
                      const cleaned = cleanMainPoint(opt);
                      return (
                        <button
                          key={idx}
                          type="button"
                          className="claude-suggestion-item-1col"
                          onClick={() => handleSuggestionChipClick(cleaned)}
                          title={`Send: "${cleaned}"`}
                          disabled={isSending}
                        >
                          <div className="suggestion-item-left">
                            <span className="suggestion-bullet-dot">•</span>
                            <span className="suggestion-text-main">{cleaned}</span>
                          </div>
                          <ArrowUpRight size={13} className="claude-item-arrow" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Voice Listening Mode (replaces input bar with animated music listening waveform) */}
              {isRecordingVoice ? (
                <div className="chatgpt-capsule-voice-listening">
                  <div className="voice-listening-left">
                    <div className="voice-listening-orb">
                      <span className="voice-orb-core" />
                      <span className="voice-orb-ring" />
                    </div>
                    <div className="voice-listening-info">
                      <span className="voice-listening-title">Listening...</span>
                      <span className="voice-listening-timer">
                        {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                        {String(recordingSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Music / Sound Equalizer Waveform reacting live to mic volume */}
                  <div className="voice-listening-soundwave" ref={equalizerBarsRef}>
                    <span className="voice-wave-bar bar-1" />
                    <span className="voice-wave-bar bar-2" />
                    <span className="voice-wave-bar bar-3" />
                    <span className="voice-wave-bar bar-4" />
                    <span className="voice-wave-bar bar-5" />
                    <span className="voice-wave-bar bar-6" />
                    <span className="voice-wave-bar bar-7" />
                    <span className="voice-wave-bar bar-8" />
                    <span className="voice-wave-bar bar-9" />
                    <span className="voice-wave-bar bar-10" />
                    <span className="voice-wave-bar bar-11" />
                    <span className="voice-wave-bar bar-12" />
                    <span className="voice-wave-bar bar-13" />
                    <span className="voice-wave-bar bar-14" />
                    <span className="voice-wave-bar bar-15" />
                    <span className="voice-wave-bar bar-16" />
                  </div>

                  <div className="voice-listening-actions">
                    {/* Cancel Button */}
                    <button
                      type="button"
                      className="voice-action-btn cancel"
                      onClick={cancelVoiceRecording}
                      title="Cancel voice recording"
                    >
                      <X size={16} />
                    </button>

                    {/* Option 2: Translate to Input (Edit before sending) */}
                    <button
                      type="button"
                      className="voice-action-btn to-input"
                      onClick={() => stopVoiceRecording('input')}
                      title="Translate voice into input bar (edit before sending)"
                    >
                      <Pencil size={13} />
                      <span>Translate</span>
                    </button>

                    {/* Option 1: Direct Enter (Auto-send) */}
                    <button
                      type="button"
                      className="voice-action-btn direct-send"
                      onClick={() => stopVoiceRecording('send')}
                      title="Direct Enter (Transcribe & send immediately)"
                    >
                      <ArrowUp size={16} strokeWidth={2.8} />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ChatGPT Single-Row Capsule Bar (Exact match to ChatGPT 4o screenshot) */
                <form
                  onSubmit={handleSendMessage}
                  onPaste={handlePaste}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`chatgpt-capsule-bar${isDraggingOver ? ' drag-over' : ''}`}
                >
                  {/* Hidden file pickers */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept=".pdf,.docx,.doc,.txt,.md,.json,.csv,.pptx,.ppt,.xlsx,.xls,.mp3,.wav,.m4a,.webm,.ogg,.aac,.flac,image/*"
                    style={{ display: 'none' }}
                  />
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/jpg,image/gif"
                    style={{ display: 'none' }}
                  />

                  {/* Left: Plus (+) Attachment Button with Popover Menu */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={attachMenuRef}>
                    <button
                      type="button"
                      className={`chatgpt-capsule-plus-btn ${showAttachMenu ? 'active' : ''}`}
                      onClick={() => setShowAttachMenu((prev) => !prev)}
                      disabled={isSending || isReadingAnyFile || !selectedCourse}
                      title="Add attachments (Notes, PDFs, Images)"
                    >
                      <Plus size={20} strokeWidth={2.2} />
                    </button>

                    {/* Floating Attach Menu Dropdown */}
                    {showAttachMenu && (
                      <div className="chatgpt-attach-menu">
                        <button
                          type="button"
                          className="chatgpt-attach-menu-item"
                          onClick={() => {
                            setShowAttachMenu(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <Paperclip size={16} />
                          <span>Attach files</span>
                        </button>

                        <button
                          type="button"
                          className="chatgpt-attach-menu-item"
                          onClick={() => {
                            setShowAttachMenu(false);
                            imageInputRef.current?.click();
                          }}
                        >
                          <ImageIcon size={16} />
                          <span>Upload image</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Middle: Text Input with "Ask anything" placeholder */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputMessage}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    disabled={isSending || isReadingAnyFile}
                    placeholder={
                      isDraggingOver
                        ? 'Drop files here...'
                        : readyFiles.length > 0
                          ? `Ask about ${readyFiles.length} file(s)...`
                          : 'Ask anything'
                    }
                    className="chatgpt-capsule-input"
                  />

                  {/* Right: Mic Button + Blue Waveform / Send Button */}
                  <div className="chatgpt-capsule-right">
                    {readyFiles.length > 0 && (
                      <span className="chatgpt-attached-badge">
                        <Paperclip size={12} />
                        <span>{readyFiles.length}</span>
                      </span>
                    )}

                    {/* Think Mode Toggle Button */}
                    <button
                      type="button"
                      className={`chatgpt-capsule-think-btn ${isThinkActive ? 'active' : ''}`}
                      onClick={() => setIsThinkActive((prev) => !prev)}
                      disabled={isSending || isReadingAnyFile || !selectedCourse}
                      title={isThinkActive ? 'Think Mode active (Tavily live search & deep reasoning enabled)' : 'Enable Think Mode (Tavily search + deep reasoning)'}
                    >
                      <AnimatedThinkingBook isLive={isThinkActive} isOpen={isThinkActive} size={15} color={isThinkActive ? '#4F46E5' : '#64748B'} />
                      <span>Think</span>
                    </button>

                    {/* Mic Icon Button */}
                    <button
                      type="button"
                      className="chatgpt-capsule-mic-btn"
                      onClick={startVoiceRecording}
                      disabled={isSending || isReadingAnyFile || !selectedCourse}
                      title="Voice dictation"
                    >
                      <Mic size={19} />
                    </button>

                    {/* Streaming Stop Button OR Waveform Circle (empty) OR Send Arrow (typed) */}
                    {isStreamingActive ? (
                      <button
                        type="button"
                        onClick={stopStreaming}
                        className="chatgpt-capsule-send-btn stop-active"
                        title="Stop generating"
                      >
                        <Square size={13} fill="#FFFFFF" color="#FFFFFF" />
                      </button>
                    ) : (!inputMessage.trim() && readyFiles.length === 0) ? (
                      <button
                        type="button"
                        className="chatgpt-capsule-waveform-btn"
                        onClick={startVoiceRecording}
                        disabled={isSending || isReadingAnyFile || !selectedCourse}
                        title="Start voice mode"
                      >
                        <AudioWaveform size={18} strokeWidth={2.4} color="#FFFFFF" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isSending || isReadingAnyFile}
                        className="chatgpt-capsule-send-btn"
                        title="Send message"
                      >
                        {isSending || isReadingAnyFile ? (
                          <Loader2 size={16} className="spin-animate" color="#FFFFFF" />
                        ) : (
                          <ArrowUp size={18} strokeWidth={2.5} color="#FFFFFF" />
                        )}
                      </button>
                    )}
                  </div>
                </form>
              )}


              {/* ChatGPT Disclaimer */}
              <div className="chatgpt-disclaimer">
                StudySync AI can make mistakes. Verify important academic deadlines, dates, and formulas.
              </div>
            </div>
          </div>
        </div>

        {/* Right-Side Code & File Artifact Window */}
        {activeArtifact && (
          <ArtifactPanel
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
          />
        )}
      </div>
    </div>
  );
}
