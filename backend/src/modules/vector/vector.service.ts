import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export interface VectorItem {
  id: string;
  courseId: string;
  text: string;
  vector: number[];
  metadata: {
    sourceType?: string;
    filename?: string;
    createdAt: string;
    chunkIndex?: number;
  };
}

export interface FaissInfo {
  totalVectors: number;
  dimension: number;
  faissFile: string;
  pklFile: string;
  faissSizeBytes: number;
  pklSizeBytes: number;
  engine: string;
}

class FaissVectorStore {
  private scriptPath: string;
  private inMemoryCache: VectorItem[] = [];

  constructor() {
    const possiblePaths = [
      path.resolve(__dirname, 'faiss_engine.py'),
      path.resolve(__dirname, '../../../src/modules/vector/faiss_engine.py'),
      path.resolve(__dirname, '../../src/modules/vector/faiss_engine.py'),
      path.resolve(process.cwd(), 'src/modules/vector/faiss_engine.py'),
      path.resolve(process.cwd(), 'backend/src/modules/vector/faiss_engine.py'),
    ];
    this.scriptPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];

    // Ensure it exists in current dir if in dist
    const targetScript = path.resolve(__dirname, 'faiss_engine.py');
    if (!fs.existsSync(targetScript) && fs.existsSync(this.scriptPath)) {
      try {
        fs.copyFileSync(this.scriptPath, targetScript);
        this.scriptPath = targetScript;
      } catch {}
    }

    this.initialize();
  }

  /**
   * Initializes or verifies FAISS engine (creates index.faiss and index.pkl if missing)
   */
  private initialize(): void {
    try {
      const res = this.runPythonCommand('init');
      if (res && res.success) {
        console.log(`[FAISS Vector Store] ✅ Real FAISS Engine connected! Index: ${res.faiss_file}, Vectors: ${res.total}`);
      }
    } catch (err: any) {
      console.warn('[FAISS Vector Store] Python FAISS init notice:', err.message);
    }
  }

  /**
   * Helper to execute python FAISS commands
   */
  private runPythonCommand(command: string, inputPayload?: any): any {
    try {
      const proc = spawnSync('python', [this.scriptPath, command], {
        input: inputPayload ? JSON.stringify(inputPayload) : undefined,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
      });

      if (proc.status !== 0) {
        console.warn(`[FAISS Engine] Python exited with status ${proc.status}:`, proc.stderr);
        return null;
      }

      const stdout = proc.stdout?.trim();
      if (!stdout) return null;
      return JSON.parse(stdout);
    } catch (err: any) {
      console.warn(`[FAISS Engine] Command '${command}' execution error:`, err.message);
      return null;
    }
  }

  /**
   * Add a vector chunk to the index
   */
  add(item: VectorItem): void {
    this.addBatch([item]);
  }

  /**
   * Add multiple vector chunks in batch to index.faiss and index.pkl
   */
  addBatch(newItems: VectorItem[]): void {
    if (!newItems || newItems.length === 0) return;

    // 1. Add to in-memory cache for fast local lookup
    this.inMemoryCache.push(...newItems);

    // 2. Persist to real FAISS binary index (index.faiss) & docstore pickle (index.pkl)
    const payload = newItems.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      text: item.text,
      vector: item.vector,
      metadata: item.metadata || {},
    }));

    const result = this.runPythonCommand('add', payload);
    if (result && result.success) {
      console.log(`[FAISS Vector Store] Added ${newItems.length} vectors to index.faiss & index.pkl. Total vectors in FAISS: ${result.total}`);
    } else {
      console.warn('[FAISS Vector Store] Real FAISS write had a warning, kept in memory cache.');
    }
  }

  /**
   * FAISS-style Nearest Neighbor Search (Top-K) filtered by courseId
   * Uses real FAISS IndexFlatIP (Cosine Similarity) with fallback to memory
   */
  search(queryVector: number[], courseId?: string, topK: number = 4): Array<{ item: VectorItem; score: number }> {
    // 1. Try real Python FAISS search
    const payload = {
      query_vector: queryVector,
      courseId: courseId,
      top_k: topK,
    };

    const pyResults = this.runPythonCommand('search', payload);

    if (Array.isArray(pyResults) && pyResults.length > 0) {
      return pyResults.map((r: any) => ({
        item: {
          id: r.id,
          courseId: r.courseId,
          text: r.text,
          vector: [],
          metadata: r.metadata || {},
        },
        score: r.score,
      }));
    }

    // 2. Fallback to in-memory cosine search if FAISS returns empty or offline
    return this.fallbackCosineSearch(queryVector, courseId, topK);
  }

  /**
   * Fallback in-memory search
   */
  private fallbackCosineSearch(queryVector: number[], courseId?: string, topK: number = 4): Array<{ item: VectorItem; score: number }> {
    let pool = this.inMemoryCache;
    if (courseId) {
      pool = pool.filter((item) => item.courseId === courseId);
    }
    if (pool.length === 0) return [];

    const scored = pool.map((item) => {
      let dot = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < queryVector.length; i++) {
        dot += (queryVector[i] || 0) * (item.vector[i] || 0);
        normA += (queryVector[i] || 0) ** 2;
        normB += (item.vector[i] || 0) ** 2;
      }
      const score = normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Get all materials for a course from FAISS or cache
   */
  getItemsByCourse(courseId: string): VectorItem[] {
    const pyResults = this.runPythonCommand('get_by_course', { courseId });
    if (Array.isArray(pyResults)) {
      return pyResults.map((r: any) => ({
        id: r.id,
        courseId: r.courseId,
        text: r.text,
        vector: [],
        metadata: r.metadata || {},
      }));
    }
    return this.inMemoryCache.filter((item) => item.courseId === courseId);
  }

  /**
   * Remove all vectors and document chunks associated with a deleted course
   */
  deleteCourseVectors(courseId: string): void {
    if (!courseId) return;

    // 1. Remove from in-memory cache
    this.inMemoryCache = this.inMemoryCache.filter((v) => v.courseId !== courseId);

    // 2. Remove from real FAISS index & docstore
    const res = this.runPythonCommand('delete_course', { courseId });
    if (res && res.success) {
      console.log(`[FAISS Vector Store] Purged all vectors for course "${courseId}". Remaining in FAISS: ${res.remaining_vectors}`);
    } else {
      console.warn(`[FAISS Vector Store] delete_course Python warning for "${courseId}". In-memory cache purged.`);
    }
  }

  /**
   * Detailed metadata info about the FAISS index files (index.faiss and index.pkl)
   */
  getInfo(): FaissInfo {
    const pyInfo = this.runPythonCommand('info');
    if (pyInfo) {
      return {
        totalVectors: pyInfo.total_vectors || 0,
        dimension: pyInfo.dimension || 768,
        faissFile: pyInfo.faiss_file,
        pklFile: pyInfo.pkl_file,
        faissSizeBytes: pyInfo.faiss_size_bytes || 0,
        pklSizeBytes: pyInfo.pkl_size_bytes || 0,
        engine: 'FAISS CPU (IndexFlatIP)',
      };
    }

    const indexDir = path.resolve(__dirname, '../../../faiss_index');
    const faissPath = path.join(indexDir, 'index.faiss');
    const pklPath = path.join(indexDir, 'index.pkl');

    return {
      totalVectors: this.inMemoryCache.length,
      dimension: 768,
      faissFile: faissPath,
      pklFile: pklPath,
      faissSizeBytes: fs.existsSync(faissPath) ? fs.statSync(faissPath).size : 0,
      pklSizeBytes: fs.existsSync(pklPath) ? fs.statSync(pklPath).size : 0,
      engine: 'FAISS (Local)',
    };
  }

  /**
   * Total chunks count
   */
  get count(): number {
    const info = this.getInfo();
    return info.totalVectors || this.inMemoryCache.length;
  }
}

export const faissStore = new FaissVectorStore();
