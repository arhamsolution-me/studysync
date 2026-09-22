import { DIAGRAM_CATALOG, DiagramTemplate } from './diagram.catalog';

export interface DiagramSearchResult {
  template: DiagramTemplate;
  score: number;
  matchedTags: string[];
}

export class DiagramVectorDB {
  private templates: DiagramTemplate[] = [];

  constructor() {
    this.templates = DIAGRAM_CATALOG;
    console.log(`[Diagram Vector DB] 🚀 Loaded ${this.templates.length} production diagram templates across 5 major domains.`);
  }

  /**
   * Retrieves all available templates in the catalog
   */
  getAllTemplates(): DiagramTemplate[] {
    return this.templates;
  }

  /**
   * Hybrid Vector & Keyword similarity search for diagram templates
   * Matches query against tags, title, category, and description
   */
  search(query: string, topK: number = 3): DiagramSearchResult[] {
    if (!query || !query.trim()) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const queryTokens = normalizedQuery
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const scored = this.templates.map((tpl) => {
      let score = 0;
      const matchedTags: string[] = [];

      // 1. Direct tag matches (highest weight)
      for (const tag of tpl.tags) {
        const lowerTag = tag.toLowerCase();
        if (normalizedQuery.includes(lowerTag)) {
          score += 10;
          matchedTags.push(tag);
        } else {
          for (const qToken of queryTokens) {
            if (lowerTag.includes(qToken) || qToken.includes(lowerTag)) {
              score += 4;
              matchedTags.push(tag);
              break;
            }
          }
        }
      }

      // 2. Title & ID matches
      const lowerTitle = tpl.title.toLowerCase();
      const lowerId = tpl.id.toLowerCase();
      if (lowerTitle.includes(normalizedQuery)) score += 8;
      for (const qToken of queryTokens) {
        if (lowerTitle.includes(qToken)) score += 3;
        if (lowerId.includes(qToken)) score += 3;
      }

      // 3. Category & Description matches
      const lowerCat = tpl.category.toLowerCase();
      const lowerDesc = tpl.description.toLowerCase();
      for (const qToken of queryTokens) {
        if (lowerCat.includes(qToken)) score += 2;
        if (lowerDesc.includes(qToken)) score += 1;
      }

      // 4. Domain synonyms boost
      if (/(ml|machine learning|deep learning|neural|train|dataset|feature|pipeline)/i.test(normalizedQuery)) {
        if (tpl.category === 'Machine Learning & AI') score += 5;
      }
      if (/(whatsapp|webhook|bot|chat|messaging)/i.test(normalizedQuery)) {
        if (tpl.id === 'whatsapp-automation-flow') score += 15;
      }
      if (/(erd|er diagram|database|schema|table|sql|entity)/i.test(normalizedQuery)) {
        if (tpl.category === 'Database Systems & ERD') score += 6;
      }
      if (/(cicd|deploy|devops|docker|kubernetes|actions)/i.test(normalizedQuery)) {
        if (tpl.category === 'Cloud & DevOps') score += 6;
      }

      return {
        template: tpl,
        score,
        matchedTags: Array.from(new Set(matchedTags)),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).slice(0, topK);
  }

  /**
   * Convenience method to get the single best reference template for LLM prompt injection
   */
  searchDiagramTemplate(query: string): DiagramTemplate | null {
    const results = this.search(query, 1);
    if (results.length > 0 && results[0].score >= 3) {
      return results[0].template;
    }
    // Fallback: If query mentions diagram/flow without specific match, default to first clean flowchart
    return this.templates[0] || null;
  }
}

export const diagramVdb = new DiagramVectorDB();
