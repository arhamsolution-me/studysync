import path from 'path';
import { aiService } from '../ai/ai.service';
import { cleanMojibake } from '../../utils/textSanitizer';

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac', '.flac', '.opus', '.wma', '.mp4'];
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tiff'];
export const PRESENTATION_EXTENSIONS = ['.pptx', '.ppt', '.odp', '.key'];
export const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.ods'];

export function isAudioFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

export function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export function isPresentationFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return PRESENTATION_EXTENSIONS.includes(ext);
}

export function isSpreadsheetFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SPREADSHEET_EXTENSIONS.includes(ext);
}

/**
 * Extracts printable ASCII/Unicode strings from binary legacy documents (.ppt, .xls)
 */
function extractPrintableTextFromBinary(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const matches = raw.match(/[\x20-\x7E\s]{4,}/g) || [];
  const cleaned = matches
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 4 &&
        !/^[0-9a-f]{8,}$/i.test(s) &&
        !/^[<>&;=%]+$/.test(s) &&
        !/^[\-_=+\\/]+$/.test(s)
    );
  return cleanMojibake(cleaned.join('\n'));
}

/**
 * Extracts structured slide text and speaker notes from PowerPoint (.pptx) presentation
 */
export async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles: string[] = [];

    // 1. Gather all slide XML files
    zip.forEach((relativePath: string) => {
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(relativePath)) {
        slideFiles.push(relativePath);
      }
    });

    // 2. Sort slides in natural order (Slide 1, Slide 2, ..., Slide 10)
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

    const slidesContent: string[] = [];

    for (let i = 0; i < slideFiles.length; i++) {
      const slidePath = slideFiles[i];
      const xml = await zip.file(slidePath)?.async('text');
      if (!xml) continue;

      const slideNumber = i + 1;
      const paragraphs: string[] = [];

      // Extract paragraph by paragraph (<a:p>...</a:p>)
      const pMatches = xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/gi) || [];
      for (const pXml of pMatches) {
        const tMatches = pXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
        const line = tMatches
          .map((t: string) => t.replace(/<a:t[^>]*>/i, '').replace(/<\/a:t>/i, ''))
          .join('')
          .trim();
        if (line) {
          paragraphs.push(line);
        }
      }

      // Fallback: extract any stray text runs (<a:t>)
      if (paragraphs.length === 0) {
        const allT = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
        const joined = allT
          .map((t: string) => t.replace(/<a:t[^>]*>/i, '').replace(/<\/a:t>/i, '').trim())
          .filter(Boolean)
          .join(' ');
        if (joined) paragraphs.push(joined);
      }

      if (paragraphs.length > 0) {
        slidesContent.push(`## Slide ${slideNumber}\n${paragraphs.join('\n')}`);
      }
    }

    // 3. Extract speaker notes if available (ppt/notesSlides/notesSlide*.xml)
    const noteFiles: string[] = [];
    zip.forEach((relativePath: string) => {
      if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(relativePath)) {
        noteFiles.push(relativePath);
      }
    });

    if (noteFiles.length > 0) {
      noteFiles.sort((a, b) => {
        const numA = parseInt(a.match(/notesSlide(\d+)\.xml/i)?.[1] || '0', 10);
        const numB = parseInt(b.match(/notesSlide(\d+)\.xml/i)?.[1] || '0', 10);
        return numA - numB;
      });

      for (let i = 0; i < noteFiles.length; i++) {
        const noteXml = await zip.file(noteFiles[i])?.async('text');
        if (!noteXml) continue;
        const pMatches = noteXml.match(/<a:p[\s>][\s\S]*?<\/a:p>/gi) || [];
        const noteLines: string[] = [];
        for (const pXml of pMatches) {
          const tMatches = pXml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/gi) || [];
          const line = tMatches
            .map((t: string) => t.replace(/<a:t[^>]*>/i, '').replace(/<\/a:t>/i, ''))
            .join('')
            .trim();
          if (line && !/^\d+$/.test(line)) {
            noteLines.push(line);
          }
        }
        if (noteLines.length > 0) {
          slidesContent.push(`### Speaker Notes (Slide ${i + 1})\n${noteLines.join('\n')}`);
        }
      }
    }

    if (slidesContent.length > 0) {
      return cleanMojibake(slidesContent.join('\n\n'));
    }
  } catch (err: any) {
    console.warn('[DocumentParser] Error unzipping PPTX, falling back to binary scan:', err?.message);
  }

  return extractPrintableTextFromBinary(buffer);
}

/**
 * Extracts sheet data and text from Excel (.xlsx) spreadsheet
 */
export async function extractTextFromXlsx(buffer: Buffer): Promise<string> {
  try {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const sections: string[] = [];

    // 1. Extract shared strings table (contains all text strings in workbook)
    const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('text');
    if (sharedXml) {
      const tMatches = sharedXml.match(/<t[^>]*>([\s\S]*?)<\/t>/gi) || [];
      const strings = tMatches
        .map((t: string) => t.replace(/<t[^>]*>/i, '').replace(/<\/t>/i, '').trim())
        .filter(Boolean);
      if (strings.length > 0) {
        sections.push(`### Spreadsheet Data & Headers:\n${strings.join('\n')}`);
      }
    }

    if (sections.length > 0) {
      return cleanMojibake(sections.join('\n\n'));
    }
  } catch (err: any) {
    console.warn('[DocumentParser] Error unzipping XLSX, falling back to binary scan:', err?.message);
  }

  return extractPrintableTextFromBinary(buffer);
}

export async function extractTextFromBuffer(buffer: Buffer, originalFilename: string): Promise<string> {
  const ext = path.extname(originalFilename).toLowerCase();

  // 1. Image Understanding via Gemini Vision
  if (isImageFile(originalFilename)) {
    console.log(`[DocumentParser] Analyzing image "${originalFilename}" via Gemini Vision...`);
    try {
      const analysis = await aiService.analyzeImage(buffer, originalFilename);
      return analysis ? analysis.trim() : '';
    } catch (err: any) {
      console.error(`[DocumentParser] Error analyzing image ${originalFilename}:`, err?.message);
      return '';
    }
  }

  // 2. Audio / Voice Recording: Transcribe via Groq Whisper STT
  if (isAudioFile(originalFilename)) {
    console.log(`[DocumentParser] Transcribing audio file "${originalFilename}" via Groq Whisper...`);
    try {
      const transcript = await aiService.transcribeAudio(buffer, originalFilename);
      return transcript ? transcript.trim() : '';
    } catch (err: any) {
      console.error(`[DocumentParser] Error transcribing ${originalFilename}:`, err?.message);
      return '';
    }
  }

  // 3. PowerPoint Presentation Slides (.pptx / .ppt)
  if (isPresentationFile(originalFilename)) {
    console.log(`[DocumentParser] Extracting slides from presentation "${originalFilename}"...`);
    try {
      const slides = await extractTextFromPptx(buffer);
      if (slides && slides.trim().length > 0) {
        return cleanMojibake(slides);
      }
    } catch (err: any) {
      console.error(`[DocumentParser] Error parsing presentation ${originalFilename}:`, err?.message);
    }
  }

  // 4. Excel Spreadsheets (.xlsx / .xls)
  if (ext === '.xlsx' || ext === '.xls') {
    console.log(`[DocumentParser] Extracting dataset from spreadsheet "${originalFilename}"...`);
    try {
      const sheetData = await extractTextFromXlsx(buffer);
      if (sheetData && sheetData.trim().length > 0) {
        return cleanMojibake(sheetData);
      }
    } catch (err: any) {
      console.error(`[DocumentParser] Error parsing spreadsheet ${originalFilename}:`, err?.message);
    }
  }

  // 5. PDF Documents
  if (ext === '.pdf') {
    try {
      const pdfParse = require('pdf-parse-fork');
      const data = await pdfParse(buffer);
      return cleanMojibake(data.text || '');
    } catch (err: any) {
      console.error(`[DocumentParser] Error parsing ${ext} document:`, err?.message);
    }
  }

  // 6. Word Documents (.docx / .doc)
  if (ext === '.docx' || ext === '.doc') {
    try {
      const mammoth = require('mammoth');
      const res = await mammoth.extractRawText({ buffer });
      return cleanMojibake(res.value || '');
    } catch (err: any) {
      console.error(`[DocumentParser] Error parsing ${ext} document:`, err?.message);
    }
  }

  // 7. Fallback to plain text, markdown, json, csv, code files, etc.
  return cleanMojibake(buffer.toString('utf-8'));
}
