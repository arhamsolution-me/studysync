import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

// Base sandbox directory for student course workspaces
const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
const WORKSPACE_BASE_DIR = path.resolve(baseDir, 'storage', 'workspaces');

// Ensure root workspace folder exists safely
try {
  if (!fs.existsSync(WORKSPACE_BASE_DIR)) {
    fs.mkdirSync(WORKSPACE_BASE_DIR, { recursive: true });
  }
} catch {}

export function getCourseWorkspaceDir(courseId: string): string {
  const safeCourseId = courseId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(WORKSPACE_BASE_DIR, safeCourseId);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return dir;
}

/**
 * Validates that the target path remains strictly within the course workspace sandbox
 */
function resolveSafePath(courseId: string, relativePath: string): string {
  const workspaceDir = getCourseWorkspaceDir(courseId);
  const resolved = path.resolve(workspaceDir, relativePath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error('Access denied: Path points outside course workspace sandbox.');
  }
  return resolved;
}

export interface FilePresentItem {
  filepath: string;
  title: string;
  description?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  previewText?: string;
}

export function isLikelySourceCode(text: string): boolean {
  if (text.includes('```')) return false;
  const patterns = [
    /^\s*(?:import|from)\s+[a-zA-Z0-9_.]+/m,
    /^\s*def\s+[a-zA-Z0-9_]+\s*\(/m,
    /^\s*class\s+[a-zA-Z0-9_]+/m,
    /^\s*(?:const|let|var|function)\s+[a-zA-Z0-9_]+/m,
    /^\s*(?:public|private|protected)\s+(?:class|void|int|static|async)/m,
    /^\s*#include\s*<[a-z0-9_.]+>/m,
    /if\s*__name__\s*==\s*['"]__main__['"]/,
    /return\s+[a-zA-Z0-9_]+/,
    /console\.(?:log|error|warn)\(/,
    /print\s*\(/,
  ];
  return patterns.some((p) => p.test(text));
}

export function parseMarkdownInlineDocx(
  text: string,
  TextRunClass: any,
  baseFont = 'Calibri',
  baseSize = 22,
  baseColor = '1E293B'
) {
  const runs: any[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(
        new TextRunClass({
          text: text.slice(lastIndex, match.index),
          font: baseFont,
          size: baseSize,
          color: baseColor,
        })
      );
    }

    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      runs.push(
        new TextRunClass({
          text: token.slice(2, -2),
          bold: true,
          font: baseFont,
          size: baseSize,
          color: '0F172A',
        })
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      runs.push(
        new TextRunClass({
          text: token.slice(1, -1),
          italics: true,
          font: baseFont,
          size: baseSize,
          color: '334155',
        })
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      runs.push(
        new TextRunClass({
          text: token.slice(1, -1),
          font: 'Consolas',
          size: baseSize - 2,
          color: 'B45309',
          shading: { fill: 'F1F5F9' },
        })
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    runs.push(
      new TextRunClass({
        text: text.slice(lastIndex),
        font: baseFont,
        size: baseSize,
        color: baseColor,
      })
    );
  }

  return runs.length > 0
    ? runs
    : [new TextRunClass({ text, font: baseFont, size: baseSize, color: baseColor })];
}

export function createDocxCodeTable(codeLines: string[], docxLib: any) {
  const { Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } = docxLib;

  const codeParagraphs = codeLines.map((line: string) => {
    const safeText = line.replace(/\t/g, '    ');
    return new Paragraph({
      children: [
        new TextRun({
          text: safeText || ' ',
          font: 'Consolas',
          size: 19, // 9.5 pt
          color: '0F172A',
          preserveSpace: true,
        }),
      ],
      spacing: { line: 240, after: 20, before: 0 },
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: codeParagraphs.length > 0 ? codeParagraphs : [new Paragraph({ text: '' })],
            shading: { fill: 'F8FAFC' },
            margins: { top: 140, bottom: 140, left: 220, right: 220 },
            borders: {
              left: { style: BorderStyle.SINGLE, size: 24, color: '3B82F6' },
              top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
            },
          }),
        ],
      }),
    ],
  });
}

export const fileTools = {
  /**
   * create_file — create a new file in course workspace
   */
  async createFile(courseId: string, filepath: string, content: string, overwrite = true) {
    try {
      const safePath = resolveSafePath(courseId, filepath);
      const parentDir = path.dirname(safePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      if (fs.existsSync(safePath) && !overwrite) {
        return {
          success: false,
          error: `File already exists at ${filepath}. Set overwrite=true to replace it.`,
        };
      }

      fs.writeFileSync(safePath, content, 'utf-8');
      const stats = fs.statSync(safePath);

      return {
        success: true,
        message: `File created successfully at ${filepath}`,
        filepath,
        sizeBytes: stats.size,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * str_replace — surgical text replace inside an existing file
   */
  async strReplace(courseId: string, filepath: string, oldStr: string, newStr: string) {
    try {
      const safePath = resolveSafePath(courseId, filepath);
      if (!fs.existsSync(safePath)) {
        return { success: false, error: `File not found: ${filepath}` };
      }

      const content = fs.readFileSync(safePath, 'utf-8');
      const occurrences = content.split(oldStr).length - 1;

      if (occurrences === 0) {
        return {
          success: false,
          error: `Target text not found in ${filepath}. Check character casing and whitespace.`,
        };
      }

      if (occurrences > 1) {
        return {
          success: false,
          error: `Multiple matches (${occurrences}) found for the replacement string. Please provide a more unique snippet.`,
        };
      }

      const updated = content.replace(oldStr, newStr);
      fs.writeFileSync(safePath, updated, 'utf-8');

      return {
        success: true,
        message: `Replaced text in ${filepath} successfully.`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * view — inspect text content or file/directory list
   */
  async view(courseId: string, filepath = '.', offset = 0, limit = 200) {
    try {
      const safePath = resolveSafePath(courseId, filepath);
      if (!fs.existsSync(safePath)) {
        return { success: false, error: `Path does not exist: ${filepath}` };
      }

      const stats = fs.statSync(safePath);

      if (stats.isDirectory()) {
        const items = fs.readdirSync(safePath).map((name) => {
          const itemPath = path.join(safePath, name);
          const s = fs.statSync(itemPath);
          return {
            name,
            isDirectory: s.isDirectory(),
            sizeBytes: s.size,
            modified: s.mtime,
          };
        });
        return {
          success: true,
          isDirectory: true,
          filepath,
          items,
        };
      }

      // Check if binary / image
      const ext = path.extname(safePath).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf'].includes(ext)) {
        return {
          success: true,
          isBinary: true,
          filepath,
          ext,
          sizeBytes: stats.size,
          previewUrl: `/api/courses/${courseId}/workspace-file?path=${encodeURIComponent(filepath)}`,
        };
      }

      const fullContent = fs.readFileSync(safePath, 'utf-8');
      const lines = fullContent.split('\n');
      const sliced = lines.slice(offset, offset + limit);

      return {
        success: true,
        filepath,
        totalLines: lines.length,
        offset,
        limit,
        content: sliced.join('\n'),
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * present_files — produce delivery cards for completed files
   */
  async presentFiles(courseId: string, files: Array<{ filepath: string; title: string; description?: string }>) {
    const validated: FilePresentItem[] = [];

    for (const f of files) {
      try {
        const safePath = resolveSafePath(courseId, f.filepath);
        if (fs.existsSync(safePath)) {
          const stats = fs.statSync(safePath);
          let previewText: string | undefined = undefined;
          const previewFile = safePath + '.preview.txt';
          if (fs.existsSync(previewFile)) {
            try {
              previewText = fs.readFileSync(previewFile, 'utf-8');
            } catch {}
          } else {
            const ext = path.extname(f.filepath).toLowerCase();
            if (['.py', '.txt', '.md', '.csv', '.json', '.js', '.ts', '.html', '.css'].includes(ext)) {
              try {
                previewText = fs.readFileSync(safePath, 'utf-8');
              } catch {}
            }
          }

          validated.push({
            filepath: f.filepath,
            title: f.title || path.basename(f.filepath),
            description: f.description || `Generated file (${(stats.size / 1024).toFixed(1)} KB)`,
            sizeBytes: stats.size,
            downloadUrl: `/api/courses/${courseId}/workspace-file?path=${encodeURIComponent(f.filepath)}&download=true`,
            previewText,
          });
        }
      } catch {}
    }

    return {
      success: true,
      deliveredFiles: validated,
    };
  },

  /**
   * generate_downloadable_file — creates real .docx, .pdf, .py, .txt, .csv, or code files and returns download card payload
   */
  async generateDownloadableFile(
    courseId: string,
    filename: string,
    content: string,
    title?: string,
    description?: string
  ): Promise<{ success: boolean; file?: FilePresentItem; error?: string }> {
    try {
      // 1. Sanitize filename
      let cleanFilename = filename.trim().replace(/^[\\\/]+/, '');
      if (!cleanFilename) {
        cleanFilename = 'document.txt';
      }

      const safePath = resolveSafePath(courseId, cleanFilename);
      const parentDir = path.dirname(safePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const ext = path.extname(cleanFilename).toLowerCase();

      // 2. Format-specific file generation
      if (ext === '.docx') {
        const docxLib = await import('docx');
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docxLib;
        const docTitle = title || path.basename(cleanFilename, ext).replace(/[_-]/g, ' ');

        let formattedContent = content;
        if (isLikelySourceCode(content) && !content.includes('```')) {
          formattedContent = '```\n' + content + '\n```';
        }

        const lines = formattedContent.split('\n');
        const bodyElements: any[] = [];

        if (docTitle) {
          bodyElements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: docTitle,
                  font: 'Calibri',
                  size: 36, // 18pt
                  bold: true,
                  color: '0F172A',
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 240 },
            })
          );
        }

        let inCode = false;
        let codeBuffer: string[] = [];

        for (const rawLine of lines) {
          const line = rawLine.trimEnd();

          if (line.startsWith('```')) {
            if (inCode) {
              bodyElements.push(createDocxCodeTable(codeBuffer, docxLib));
              bodyElements.push(new Paragraph({ text: '', spacing: { after: 120 } }));
              codeBuffer = [];
              inCode = false;
            } else {
              inCode = true;
            }
            continue;
          }

          if (inCode) {
            codeBuffer.push(rawLine); // Keep leading whitespace and indentation!
            continue;
          }

          if (!line.trim()) {
            bodyElements.push(new Paragraph({ text: '', spacing: { after: 100 } }));
            continue;
          }

          if (line.startsWith('# ')) {
            bodyElements.push(
              new Paragraph({
                children: parseMarkdownInlineDocx(line.slice(2), TextRun, 'Calibri', 32, '0F172A'),
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 },
              })
            );
          } else if (line.startsWith('## ')) {
            bodyElements.push(
              new Paragraph({
                children: parseMarkdownInlineDocx(line.slice(3), TextRun, 'Calibri', 26, '1E293B'),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 },
              })
            );
          } else if (line.startsWith('### ')) {
            bodyElements.push(
              new Paragraph({
                children: parseMarkdownInlineDocx(line.slice(4), TextRun, 'Calibri', 22, '334155'),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 160, after: 80 },
              })
            );
          } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
            bodyElements.push(
              new Paragraph({
                children: parseMarkdownInlineDocx(line.slice(2), TextRun, 'Calibri', 22, '1E293B'),
                bullet: { level: 0 },
                spacing: { after: 60 },
              })
            );
          } else {
            const numMatch = line.match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
              bodyElements.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${numMatch[1]}.  `,
                      bold: true,
                      font: 'Calibri',
                      size: 22,
                      color: '2563EB',
                    }),
                    ...parseMarkdownInlineDocx(numMatch[2], TextRun, 'Calibri', 22, '1E293B'),
                  ],
                  spacing: { after: 60 },
                })
              );
            } else {
              bodyElements.push(
                new Paragraph({
                  children: parseMarkdownInlineDocx(line, TextRun, 'Calibri', 22, '1E293B'),
                  spacing: { after: 100, line: 260 },
                })
              );
            }
          }
        }

        if (inCode && codeBuffer.length > 0) {
          bodyElements.push(createDocxCodeTable(codeBuffer, docxLib));
        }

        const doc = new Document({
          sections: [
            {
              properties: {
                page: {
                  margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
                },
              },
              children: bodyElements,
            },
          ],
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(safePath, buffer);
      } else if (ext === '.pdf') {
        const PDFDocumentModule = await import('pdfkit');
        const PDFDocConstructor = (PDFDocumentModule as any).default || PDFDocumentModule;
        const docTitle = title || path.basename(cleanFilename, ext).replace(/[_-]/g, ' ');

        await new Promise<void>((resolve, reject) => {
          const doc = new PDFDocConstructor({ margin: 45, size: 'A4' });
          const stream = fs.createWriteStream(safePath);
          doc.pipe(stream);

          if (docTitle) {
            doc.fontSize(18).font('Helvetica-Bold').fillColor('#0F172A').text(docTitle);
            doc.moveDown(0.8);
          }

          let formattedContent = content;
          if (isLikelySourceCode(content) && !content.includes('```')) {
            formattedContent = '```\n' + content + '\n```';
          }

          const lines = formattedContent.split('\n');
          let inCode = false;
          let codeBuffer: string[] = [];

          const flushPdfCode = () => {
            if (codeBuffer.length === 0) return;
            const boxLeft = doc.page.margins.left;
            const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const lineHeight = 13;
            const totalHeight = codeBuffer.length * lineHeight + 16;

            if (doc.y + totalHeight > doc.page.height - doc.page.margins.bottom) {
              doc.addPage();
            }

            const currentY = doc.y;
            doc.save();
            doc.rect(boxLeft, currentY, boxWidth, totalHeight)
               .fillAndStroke('#F8FAFC', '#E2E8F0');
            doc.rect(boxLeft, currentY, 4, totalHeight)
               .fill('#3B82F6');
            doc.restore();

            doc.y = currentY + 8;
            for (const codeLine of codeBuffer) {
              const safeLine = codeLine.replace(/\t/g, '    ');
              doc.font('Courier').fontSize(9).fillColor('#0F172A')
                 .text(safeLine || ' ', boxLeft + 12, doc.y, { lineBreak: false });
              doc.y += lineHeight;
            }
            doc.y += 10;
            codeBuffer = [];
          };

          for (const rawLine of lines) {
            const line = rawLine.trimEnd();

            if (line.startsWith('```')) {
              if (inCode) {
                flushPdfCode();
                inCode = false;
                doc.moveDown(0.4);
              } else {
                inCode = true;
              }
              continue;
            }

            if (inCode) {
              codeBuffer.push(rawLine);
              continue;
            }

            if (!line.trim()) {
              doc.moveDown(0.4);
              continue;
            }

            if (line.startsWith('# ')) {
              doc.moveDown(0.6).fontSize(18).font('Helvetica-Bold').fillColor('#0F172A').text(line.slice(2));
              doc.moveDown(0.2);
            } else if (line.startsWith('## ')) {
              doc.moveDown(0.5).fontSize(14).font('Helvetica-Bold').fillColor('#1E293B').text(line.slice(3));
              doc.moveDown(0.2);
            } else if (line.startsWith('### ')) {
              doc.moveDown(0.4).fontSize(12).font('Helvetica-Bold').fillColor('#334155').text(line.slice(4));
              doc.moveDown(0.1);
            } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
              const cleanLine = line.slice(2).replace(/\*\*/g, '').replace(/`/g, '');
              doc.fontSize(10.5).font('Helvetica').fillColor('#1E293B').text(`  •   ${cleanLine}`);
            } else {
              const cleanLine = line.replace(/\*\*/g, '').replace(/`/g, '');
              doc.fontSize(10.5).font('Helvetica').fillColor('#1E293B').text(cleanLine);
              doc.moveDown(0.2);
            }
          }

          if (inCode) {
            flushPdfCode();
          }

          doc.end();
          stream.on('finish', () => resolve());
          stream.on('error', (err: any) => reject(err));
        });
      } else {
        // Plain text, Python, code, Markdown, CSV, etc.
        fs.writeFileSync(safePath, content, 'utf-8');
      }

      // Always save a readable preview text file alongside binary docx/pdf
      try {
        fs.writeFileSync(safePath + '.preview.txt', content, 'utf-8');
      } catch {}

      const stats = fs.statSync(safePath);
      const fileItem: FilePresentItem = {
        filepath: cleanFilename,
        title: title || cleanFilename,
        description: description || `Generated ${ext.toUpperCase().replace('.', '') || 'Text'} file (${(stats.size / 1024).toFixed(1)} KB)`,
        sizeBytes: stats.size,
        downloadUrl: `/api/courses/${courseId}/workspace-file?path=${encodeURIComponent(cleanFilename)}&download=true`,
        previewText: content,
      };

      return {
        success: true,
        file: fileItem,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * bash_tool — sandboxed command execution in course workspace
   */
  async bashTool(courseId: string, command: string, timeoutMs = 10000) {
    const workspaceDir = getCourseWorkspaceDir(courseId);

    // Security checks: Disallow dangerous / host-level commands
    const blockedPatterns = [
      /rm\s+-rf\s+[\/\\]/i,
      /del\s+\/f\s+\/s\s+\/q\s+c:/i,
      /format\s+[a-z]:/i,
      /shutdown/i,
      /stop-computer/i,
      /taskkill/i,
      /net\s+user/i,
      /curl.*\|\s*(bash|sh|powershell)/i,
      /\.env/i,
      /node_modules/i,
    ];

    for (const pat of blockedPatterns) {
      if (pat.test(command)) {
        return {
          success: false,
          error: `Execution denied: Command matched restricted security pattern.`,
        };
      }
    }

    return new Promise((resolve) => {
      exec(
        command,
        {
          cwd: workspaceDir,
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 * 2, // 2MB max
          env: {
            ...process.env,
            WORKSPACE_DIR: workspaceDir,
            COURSE_ID: courseId,
          },
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              exitCode: error.code || 1,
              error: error.message,
              stdout: stdout ? stdout.trim() : '',
              stderr: stderr ? stderr.trim() : '',
            });
            return;
          }

          resolve({
            success: true,
            exitCode: 0,
            stdout: stdout ? stdout.trim() : '',
            stderr: stderr ? stderr.trim() : '',
          });
        }
      );
    });
  },
};
