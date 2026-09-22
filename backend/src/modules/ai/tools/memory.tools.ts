import fs from 'fs';
import path from 'path';

// Base persistent memory directory
const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
const MEMORY_BASE_DIR = path.resolve(baseDir, 'storage', 'memory');

try {
  if (!fs.existsSync(MEMORY_BASE_DIR)) {
    fs.mkdirSync(MEMORY_BASE_DIR, { recursive: true });
  }
} catch {}

export function getCourseMemoryDir(courseId: string): string {
  const safeId = courseId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(MEMORY_BASE_DIR, safeId);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return dir;
}

function resolveSafeMemoryPath(courseId: string, topicOrKey: string): string {
  const memoryDir = getCourseMemoryDir(courseId);
  // Ensure extension is .md or .json
  let filename = topicOrKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (!filename.includes('.')) {
    filename += '.md';
  }
  const resolved = path.resolve(memoryDir, filename);
  if (!resolved.startsWith(memoryDir)) {
    throw new Error('Access denied: Memory key path out of bounds.');
  }
  return resolved;
}

export const memoryTools = {
  /**
   * memory_read — read a saved memory file
   */
  async memoryRead(courseId: string, topicOrKey: string) {
    try {
      const safePath = resolveSafeMemoryPath(courseId, topicOrKey);
      if (!fs.existsSync(safePath)) {
        return {
          success: false,
          error: `No memory found for key: ${topicOrKey}`,
        };
      }
      const content = fs.readFileSync(safePath, 'utf-8');
      return {
        success: true,
        key: topicOrKey,
        content,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * memory_write — create or overwrite memory file
   */
  async memoryWrite(courseId: string, topicOrKey: string, content: string) {
    try {
      const safePath = resolveSafeMemoryPath(courseId, topicOrKey);
      fs.writeFileSync(safePath, content, 'utf-8');
      return {
        success: true,
        message: `Saved memory for "${topicOrKey}" successfully.`,
        key: topicOrKey,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * memory_append — add a new line or timestamped note to memory
   */
  async memoryAppend(courseId: string, topicOrKey: string, entry: string) {
    try {
      const safePath = resolveSafeMemoryPath(courseId, topicOrKey);
      const timestamp = new Date().toISOString().split('T')[0];
      const formattedEntry = `\n- [${timestamp}] ${entry}`;

      if (fs.existsSync(safePath)) {
        fs.appendFileSync(safePath, formattedEntry, 'utf-8');
      } else {
        fs.writeFileSync(safePath, `# Memory: ${topicOrKey}\n${formattedEntry}`, 'utf-8');
      }

      return {
        success: true,
        message: `Appended note to memory "${topicOrKey}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * memory_str_replace — surgically edit a specific memory line
   */
  async memoryStrReplace(courseId: string, topicOrKey: string, oldText: string, newText: string) {
    try {
      const safePath = resolveSafeMemoryPath(courseId, topicOrKey);
      if (!fs.existsSync(safePath)) {
        return { success: false, error: `Memory key not found: ${topicOrKey}` };
      }

      const content = fs.readFileSync(safePath, 'utf-8');
      if (!content.includes(oldText)) {
        return {
          success: false,
          error: `Specified old_text was not found inside memory "${topicOrKey}".`,
        };
      }

      const updated = content.replace(oldText, newText);
      fs.writeFileSync(safePath, updated, 'utf-8');

      return {
        success: true,
        message: `Updated memory for "${topicOrKey}".`,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * memory_list — list all active persistent memories for course
   */
  async memoryList(courseId: string) {
    try {
      const memoryDir = getCourseMemoryDir(courseId);
      const files = fs.readdirSync(memoryDir).map((filename) => {
        const filePath = path.join(memoryDir, filename);
        const stats = fs.statSync(filePath);
        return {
          key: filename,
          sizeBytes: stats.size,
          lastUpdated: stats.mtime,
        };
      });

      return {
        success: true,
        totalMemories: files.length,
        memories: files,
      };
    } catch (err: any) {
      return { success: false, memories: [], error: err.message };
    }
  },

  /**
   * memory_delete — delete a memory file
   */
  async memoryDelete(courseId: string, topicOrKey: string, confirmation = false) {
    try {
      if (!confirmation) {
        return {
          success: false,
          error: 'Explicit confirmation=true required to delete persistent memory.',
        };
      }
      const safePath = resolveSafeMemoryPath(courseId, topicOrKey);
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
        return {
          success: true,
          message: `Memory "${topicOrKey}" deleted successfully.`,
        };
      }
      return { success: false, error: `Memory key not found: ${topicOrKey}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
