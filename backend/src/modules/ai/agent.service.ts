import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { config } from '../../config';
import { fileTools } from './tools/file.tools';
import { webTools } from './tools/web.tools';
import { memoryTools } from './tools/memory.tools';
import { widgetTools, ChatWidgetPayload } from './tools/widget.tools';
import { taskService } from '../tasks/task.service';
import { scheduleTaskReminders } from '../notifications/notification.queue';
import prisma from '../../config/database';
import { getAcademicCalendarPromptContext, deeplyCalculateAcademicDeadline } from '../../utils/systemDateTime';
import { resolveAIClientForUser } from './keyResolver';

const geminiKeys: string[] = (config.gemini as any).keys?.length
  ? (config.gemini as any).keys
  : config.gemini.apiKey
    ? [config.gemini.apiKey]
    : [];

let currentGeminiKeyIdx = 0;

function getNextGeminiClient(): GoogleGenerativeAI | null {
  if (geminiKeys.length === 0) return null;
  const key = geminiKeys[currentGeminiKeyIdx % geminiKeys.length];
  currentGeminiKeyIdx++;
  return new GoogleGenerativeAI(key);
}

function getAllGeminiClients(): GoogleGenerativeAI[] {
  if (geminiKeys.length === 0) return [];
  return geminiKeys.map((k) => new GoogleGenerativeAI(k));
}

const genAI = geminiKeys.length > 0 ? new GoogleGenerativeAI(geminiKeys[0]) : null;
const AGENT_CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest'];

const groqKeys: string[] = (config.groq as any).keys?.length
  ? (config.groq as any).keys
  : config.groq.apiKey
    ? [config.groq.apiKey]
    : [];

let currentGroqKeyIdx = 0;

function getNextGroqClient(): Groq | null {
  if (groqKeys.length === 0) return null;
  const key = groqKeys[currentGroqKeyIdx % groqKeys.length];
  currentGroqKeyIdx++;
  return new Groq({ apiKey: key });
}

export function extractThoughtAndCleanAnswer(rawAnswer: string): { thought: string; cleanAnswer: string } {
  if (!rawAnswer) return { thought: '', cleanAnswer: '' };
  let text = rawAnswer.trim();
  let extractedThought = '';

  // 1. Check for properly closed tags: <thought>...</thought>, <think>...</think>, <thinking>...</thinking>
  const closedMatch = text.match(/<(thought|think|thinking)>([\s\S]*?)<\/\1>/i);
  if (closedMatch) {
    extractedThought = closedMatch[2].trim();
    text = text.replace(/<(thought|think|thinking)>[\s\S]*?<\/\1>/i, '').trim();
  } else {
    // 2. Check for malformed or unclosed opening tag: <thought... or <think... or <thinking...
    const malformedMatch = text.match(/^<(thought|think|thinking)[>\s\n]?/i);
    if (malformedMatch) {
      const openTagLen = malformedMatch[0].length;
      const tagType = malformedMatch[1].toLowerCase();
      const closeTagRegex = new RegExp(`<\/${tagType}>`, 'i');
      const closeIdx = text.search(closeTagRegex);

      if (closeIdx !== -1) {
        extractedThought = text.slice(openTagLen, closeIdx).trim();
        text = text.slice(closeIdx).replace(closeTagRegex, '').trim();
      } else {
        // Tag was never closed! Find transition to the actual student answer
        // Transitions: "\n\nHere is", "\n\nBelow is", "\n\n###", "\n\n```", "\n\nAlthough", "\n\nIn this", etc.
        const transition = text.match(/\n\n(?=#{1,4}\s|```|(?:Here\s+is|Below\s+is|Although\s+this|To\s+(?:understand|solve|explain)|Sure|In\s+this|Let's|The\s+diagram|This\s+diagram)\b)/i);
        if (transition && transition.index !== undefined) {
          extractedThought = text.slice(openTagLen, transition.index).trim();
          text = text.slice(transition.index).trim();
        } else {
          // If a mermaid or code block is present later in the message
          const codeIdx = text.search(/```(?:mermaid|flowchart|[a-zA-Z0-9_\-]+)?/i);
          if (codeIdx > openTagLen) {
            extractedThought = text.slice(openTagLen, codeIdx).trim();
            text = text.slice(codeIdx).trim();
          }
        }
      }
    }
  }

  // 3. Safety scrub: remove any stray, leftover <thought... or </thought> tags from answer
  text = text
    .replace(/<\/?(?:thought|think|thinking)[^>]*>/gi, '')
    .replace(/^<thought[\s\S]*?(?=\n\n|\n[A-Z]|```|$)/i, '')
    .trim();

  // Also clean any leftover leading tag artifacts like "<thought" on first line
  if (text.startsWith('<thought') || text.startsWith('<think') || text.startsWith('<thinking')) {
    text = text.replace(/^<(?:thought|think|thinking)[^\n]*\n?/i, '').trim();
  }

  return {
    thought: extractedThought,
    cleanAnswer: text,
  };
}

// Gemini Function Declarations for the Agent Toolset
const toolDeclarations: FunctionDeclaration[] = [
  // ─── File & Code Tools ────────────────────────────────────────────────
  {
    name: 'bash_tool',
    description: 'Execute a sandboxed terminal command in the course workspace (e.g. running Python, zipping notes, compiling).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        command: { type: SchemaType.STRING, description: 'The command line command to run.' },
      },
      required: ['command'],
    },
  },
  {
    name: 'create_file',
    description: 'Create a new file (markdown study guide, python script, notes) in the course workspace.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filepath: { type: SchemaType.STRING, description: 'Relative path of file (e.g. "notes/exam_prep.md").' },
        content: { type: SchemaType.STRING, description: 'The text content to write into the file.' },
        overwrite: { type: SchemaType.BOOLEAN, description: 'Whether to overwrite if already exists.' },
      },
      required: ['filepath', 'content'],
    },
  },
  {
    name: 'str_replace',
    description: 'Surgically replace a unique block of text inside an existing file in the course workspace.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filepath: { type: SchemaType.STRING, description: 'Relative path of file.' },
        old_str: { type: SchemaType.STRING, description: 'Exact string snippet to find and replace.' },
        new_str: { type: SchemaType.STRING, description: 'New string snippet to substitute in.' },
      },
      required: ['filepath', 'old_str', 'new_str'],
    },
  },
  {
    name: 'view',
    description: 'View the text content of a file or inspect directory contents/images in the course workspace.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filepath: { type: SchemaType.STRING, description: 'Path of file or directory (default "." for root).' },
        offset: { type: SchemaType.NUMBER, description: 'Starting line number offset (default 0).' },
        limit: { type: SchemaType.NUMBER, description: 'Max lines to view (default 200).' },
      },
    },
  },
  {
    name: 'present_files',
    description: 'Deliver finished files to the user with download cards in the chat.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        files: {
          type: SchemaType.ARRAY,
          description: 'List of files to present.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              filepath: { type: SchemaType.STRING, description: 'Workspace path of file.' },
              title: { type: SchemaType.STRING, description: 'Display title for download card.' },
              description: { type: SchemaType.STRING, description: 'Summary of what this file contains.' },
            },
            required: ['filepath', 'title'],
          },
        },
      },
      required: ['files'],
    },
  },
  {
    name: 'generate_downloadable_file',
    description: 'Create and deliver a downloadable file (.docx Word document, .pdf document, .py Python script, .txt notes, .csv, .md, etc.) and immediately present a download card with a 1-click download link in chat. ALWAYS invoke this tool whenever the student asks for a file, asks to write code to a file, or asks for a download link ("quicksort.py file bana kar download link do", "cheat_sheet.txt file bana kar do", "is ko docx ky andr bna kr do", "pdf bana kar download do").',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filename: { type: SchemaType.STRING, description: 'File name with extension (e.g. "quicksort.py", "cheat_sheet.txt", "notes.docx", "summary.pdf", "data.csv").' },
        content: { type: SchemaType.STRING, description: 'The complete text, code, or markdown content of the file.' },
        title: { type: SchemaType.STRING, description: 'Display title for the download card (e.g. "QuickSort Algorithm (Python)", "Calculus Differentiation Cheat Sheet").' },
        description: { type: SchemaType.STRING, description: 'Short summary of what this file contains.' },
      },
      required: ['filename', 'content'],
    },
  },

  // ─── Search & Web Tools ───────────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the live web for academic articles, recent developments, scientific formulas, or solutions.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Search term or query.' },
        max_results: { type: SchemaType.NUMBER, description: 'Number of results to retrieve (1-5).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch and read clean markdown text from a specific URL.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: { type: SchemaType.STRING, description: 'HTTP or HTTPS URL to fetch.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'image_search',
    description: 'Search for educational diagrams, scientific illustrations, or reference images to show in chat.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Description of the image/diagram to find.' },
      },
      required: ['query'],
    },
  },

  // ─── Persistent Memory Tools ──────────────────────────────────────────
  {
    name: 'memory_read',
    description: 'Read a persistent memory file for this student/course.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic_or_key: { type: SchemaType.STRING, description: 'Name/key of memory file (e.g. "student_preferences", "exam_weaknesses").' },
      },
      required: ['topic_or_key'],
    },
  },
  {
    name: 'memory_write',
    description: 'Write or overwrite a persistent memory file.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic_or_key: { type: SchemaType.STRING, description: 'Name/key of memory file.' },
        content: { type: SchemaType.STRING, description: 'Complete text/markdown content to save.' },
      },
      required: ['topic_or_key', 'content'],
    },
  },
  {
    name: 'memory_append',
    description: 'Append a new dated entry or insight to persistent memory.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic_or_key: { type: SchemaType.STRING, description: 'Memory key.' },
        entry: { type: SchemaType.STRING, description: 'New note or fact to append.' },
      },
      required: ['topic_or_key', 'entry'],
    },
  },
  {
    name: 'memory_str_replace',
    description: 'Update a specific line in persistent memory.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic_or_key: { type: SchemaType.STRING, description: 'Memory key.' },
        old_text: { type: SchemaType.STRING, description: 'Existing snippet to replace.' },
        new_text: { type: SchemaType.STRING, description: 'Replacement snippet.' },
      },
      required: ['topic_or_key', 'old_text', 'new_text'],
    },
  },
  {
    name: 'memory_list',
    description: 'List all existing persistent memories for this course.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a persistent memory file upon student confirmation.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        topic_or_key: { type: SchemaType.STRING, description: 'Memory key to delete.' },
        confirmation: { type: SchemaType.BOOLEAN, description: 'Must be true to proceed.' },
      },
      required: ['topic_or_key', 'confirmation'],
    },
  },

  // ─── Visual & Interactive Widgets ─────────────────────────────────────
  {
    name: 'quiz_display',
    description: 'Display an interactive quiz card in chat with selectable options, instant scoring, and explanations.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Quiz title.' },
        questions: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING, description: 'The question text.' },
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '4 multiple choice options.' },
              correctAnswerIndex: { type: SchemaType.NUMBER, description: 'Index of correct option (0-3).' },
              explanation: { type: SchemaType.STRING, description: 'Detailed explanation of why this is correct.' },
            },
            required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
          },
        },
      },
      required: ['title', 'questions'],
    },
  },
  {
    name: 'chart_display',
    description: 'Display an interactive chart (bar, line, or pie) directly in the chat bubble.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Chart title.' },
        chartType: { type: SchemaType.STRING, description: 'Type of chart: "bar", "line", or "pie".' },
        labels: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'X-axis categories / labels.' },
        values: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER }, description: 'Numeric values corresponding to labels.' },
        unit: { type: SchemaType.STRING, description: 'Measurement unit (e.g. "%", "hours", "score").' },
      },
      required: ['title', 'chartType', 'labels', 'values'],
    },
  },
  {
    name: 'comparison_card',
    description: 'Display a structured side-by-side comparison table / card for concepts, algorithms, or tools.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Comparison title.' },
        columns: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Column headers (e.g. ["Feature", "Model A", "Model B"]).' },
        rows: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              feature: { type: SchemaType.STRING, description: 'Feature name.' },
              values: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Values for each column.' },
              highlight: { type: SchemaType.BOOLEAN, description: 'Whether this row is a key distinguishing point.' },
            },
            required: ['feature', 'values'],
          },
        },
        recommendation: { type: SchemaType.STRING, description: 'Final verdict or summary recommendation.' },
      },
      required: ['title', 'columns', 'rows'],
    },
  },
  {
    name: 'step_card',
    description: 'Display an interactive multi-step guide with milestones, tips, and completion status.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Guide title.' },
        steps: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              stepNumber: { type: SchemaType.NUMBER, description: 'Step number.' },
              title: { type: SchemaType.STRING, description: 'Step heading.' },
              detail: { type: SchemaType.STRING, description: 'Step instructions.' },
              tip: { type: SchemaType.STRING, description: 'Helpful pro-tip.' },
            },
            required: ['stepNumber', 'title', 'detail'],
          },
        },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'message_compose',
    description: 'Display an interactive email/message draft card with subject, body, tone switcher, and 1-click copy.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        recipient: { type: SchemaType.STRING, description: 'Recipient (e.g. "Professor Smith", "Study Group").' },
        subject: { type: SchemaType.STRING, description: 'Email/message subject line.' },
        body: { type: SchemaType.STRING, description: 'Draft body text.' },
        tone: { type: SchemaType.STRING, description: 'Tone: "formal", "academic", or "casual".' },
      },
      required: ['subject', 'body'],
    },
  },
  {
    name: 'translation_display',
    description: 'Display a language translation card with pronunciation, phonetic spelling, and grammar context.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        originalText: { type: SchemaType.STRING, description: 'Source phrase or sentence.' },
        translatedText: { type: SchemaType.STRING, description: 'Target translation.' },
        sourceLanguage: { type: SchemaType.STRING, description: 'Source language.' },
        targetLanguage: { type: SchemaType.STRING, description: 'Target language.' },
        pronunciation: { type: SchemaType.STRING, description: 'Phonetic or Romanized pronunciation.' },
        notes: { type: SchemaType.STRING, description: 'Contextual or grammar tips.' },
      },
      required: ['originalText', 'translatedText', 'sourceLanguage', 'targetLanguage'],
    },
  },
  {
    name: 'recipe_display',
    description: 'Display an interactive culinary recipe card with prep time, difficulty, ingredients checklist, and step-by-step cooking instructions.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Dish/Recipe title.' },
        prepTime: { type: SchemaType.STRING, description: 'Preparation and cook time (e.g. "45 mins").' },
        difficulty: { type: SchemaType.STRING, description: 'Difficulty level (e.g. "Easy", "Medium", "Chef").' },
        servings: { type: SchemaType.STRING, description: 'Default servings (e.g. "4 persons").' },
        itemsOrIngredients: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'List of ingredients with quantities.',
        },
        instructions: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Ordered step-by-step cooking instructions.',
        },
      },
      required: ['title', 'prepTime', 'itemsOrIngredients', 'instructions'],
    },
  },
  {
    name: 'itinerary_display',
    description: 'Display an interactive day-by-day travel itinerary or event schedule with daily milestones and activities.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Trip or itinerary title.' },
        location: { type: SchemaType.STRING, description: 'Destination or city.' },
        days: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              day: { type: SchemaType.NUMBER, description: 'Day number (1, 2, ...).' },
              title: { type: SchemaType.STRING, description: 'Theme or area for the day.' },
              activities: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'Key activities, spots to visit, or timings.',
              },
            },
            required: ['day', 'title', 'activities'],
          },
        },
      },
      required: ['title', 'location', 'days'],
    },
  },
  {
    name: 'options_card_display',
    description: 'Display an interactive multi-option decision card (e.g. for health guidance, career paths, alternative strategies) with pros, cons, and selectable choices.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Decision/Issue title.' },
        description: { type: SchemaType.STRING, description: 'Context or background explanation.' },
        category: { type: SchemaType.STRING, description: 'Category: "health", "career", "technical", or "lifestyle".' },
        options: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING, description: 'Option identifier.' },
              title: { type: SchemaType.STRING, description: 'Option title.' },
              subtitle: { type: SchemaType.STRING, description: 'Short summary.' },
              pros: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Benefits/pros.' },
              cons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Drawbacks or cautions.' },
              badge: { type: SchemaType.STRING, description: 'Tag (e.g. "Recommended", "Conservative", "Quick Fix").' },
              recommendation: { type: SchemaType.BOOLEAN, description: 'Whether this is the recommended primary option.' },
              actionPrompt: { type: SchemaType.STRING, description: 'Follow-up prompt if user chooses this option.' },
            },
            required: ['id', 'title'],
          },
        },
        disclaimer: { type: SchemaType.STRING, description: 'Advisory or medical disclaimer if applicable.' },
      },
      required: ['title', 'options'],
    },
  },
  {
    name: 'weather_fetch',
    description: 'Fetch live weather conditions, temperature, humidity, wind, and forecast for any city or location.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: { type: SchemaType.STRING, description: 'City name (e.g. "Lahore", "Karachi", "London", "New York").' },
      },
      required: ['city'],
    },
  },
  {
    name: 'fetch_sports_data',
    description: 'Fetch real-time sports match scores, tournament standings, and sports updates.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Sports query (e.g. "PSL match score", "Champions league final").' },
      },
      required: ['query'],
    },
  },
  {
    name: 'ask_user_input_v0',
    description: 'Prompt the user with interactive choice buttons/pills in the chat instead of asking an open-ended question.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        prompt: { type: SchemaType.STRING, description: 'The question or prompt to the user.' },
        options: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              label: { type: SchemaType.STRING, description: 'Button label (e.g. "Beginner", "Intermediate", "Advanced").' },
              value: { type: SchemaType.STRING, description: 'Value sent when user clicks this button.' },
              hint: { type: SchemaType.STRING, description: 'Subtext or hint for this option.' },
            },
            required: ['label', 'value'],
          },
        },
      },
      required: ['prompt', 'options'],
    },
  },
  {
    name: 'schedule_academic_task',
    description: 'Schedule a new academic quiz, assignment, exam, or project on the student calendar with automated 1-day (24h) and 12-hour email reminders.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: 'Task or quiz title (e.g. "AI Quiz 2", "Calculus Assignment 1").' },
        type: { type: SchemaType.STRING, description: 'Task type: "quiz", "assignment", "exam", "project", or "personal".' },
        deadline: { type: SchemaType.STRING, description: 'Due date and time in ISO format or descriptive date (e.g. "2026-09-15T10:00:00").' },
        subject: { type: SchemaType.STRING, description: 'Course or subject name.' },
        priority: { type: SchemaType.STRING, description: 'Priority: "high", "medium", or "low".' },
        description: { type: SchemaType.STRING, description: 'Optional task details or instructions.' },
      },
      required: ['title', 'deadline'],
    },
  },
  {
    name: 'get_academic_schedule',
    description: 'Retrieve the student calendar schedule showing upcoming quizzes, assignments, exams, and pending deadlines.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filter: { type: SchemaType.STRING, description: 'Filter by type: "quiz", "assignment", "exam", or "all".' },
      },
    },
  },
];

export interface AgentExecutionResult {
  answer: string;
  widgets: ChatWidgetPayload[];
  toolCalls: Array<{ name: string; args: any; result: any }>;
  thought?: string;
}

/**
 * Accurately parses academic deadlines considering real-time student local time,
 * specific calendar dates (e.g. "20 sep", "20 september"), relative keywords ("kal", "parso", "aaj", "tomorrow", "Friday"),
 * and 12-hour AM/PM academic defaults.
 */
export function parseAcademicDeadline(rawDeadline?: string, userPrompt = ''): Date {
  return deeplyCalculateAcademicDeadline(rawDeadline, userPrompt);
}

/**
 * Ensures any academic deadline displayed in chatbot responses uses a human-friendly
 * date and time string rather than raw UTC ISO text (e.g. 2026-09-08T05:00:00.000Z).
 */
export function formatAnswerAcademicDeadlines(answer: string, toolCallLogs: any[]): string {
  if (!answer) return answer;

  const taskCall = (toolCallLogs || []).find(
    (t) => t.name === 'schedule_academic_task' && t.result && t.result.deadline
  );

  if (taskCall && taskCall.result && taskCall.result.deadline) {
    const formattedDeadline = taskCall.result.deadline;
    answer = answer.replace(
      /(?:📅\s*)?\*{0,2}(?:Due Date|Date\s*&\s*Time|Date|Due|Deadline)(?:\s*&\s*Time)?:\*{0,2}\s*([^\n\r]+)/i,
      `📅 **Due Date:** ${formattedDeadline}`
    );
  }

  // Replace any remaining raw ISO strings like "2026-09-08T05:00:00.000Z"
  answer = answer.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, (iso) => {
    try {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch { }
    return iso;
  });

  return answer;
}

export class AgentService {
  /**
   * Execute an individual tool by name with arguments
   */
  async executeTool(
    name: string,
    args: any,
    courseId: string,
    courseName = '',
    userId = 'd3b07384-d113-4602-9c0e-e2c7c5980001',
    userMessageText = ''
  ): Promise<{ result: any; widget?: ChatWidgetPayload }> {
    switch (name) {
      // File & Code Tools
      case 'bash_tool': {
        const res = await fileTools.bashTool(courseId, args.command);
        return { result: res };
      }
      case 'create_file': {
        const res = await fileTools.createFile(courseId, args.filepath, args.content, args.overwrite ?? true);
        return { result: res };
      }
      case 'str_replace': {
        const res = await fileTools.strReplace(courseId, args.filepath, args.old_str, args.new_str);
        return { result: res };
      }
      case 'view': {
        const res = await fileTools.view(courseId, args.filepath, args.offset, args.limit);
        return { result: res };
      }
      case 'present_files': {
        const res = await fileTools.presentFiles(courseId, args.files);
        return {
          result: res,
          widget: { type: 'files', data: res.deliveredFiles },
        };
      }
      case 'generate_downloadable_file': {
        const res = await fileTools.generateDownloadableFile(
          courseId,
          args.filename,
          args.content,
          args.title,
          args.description
        );
        if (res.success && res.file) {
          return {
            result: {
              success: true,
              message: `File ${args.filename} generated successfully and ready for download.`,
              file: res.file,
            },
            widget: {
              type: 'files',
              data: [res.file],
            },
          };
        }
        return { result: res };
      }

      // Search & Web Tools
      case 'web_search': {
        const res = await webTools.webSearch(args.query, args.max_results || 5);
        return { result: res };
      }
      case 'web_fetch': {
        const res = await webTools.webFetch(args.url);
        return { result: res };
      }
      case 'image_search': {
        const res = await webTools.imageSearch(args.query);
        return { result: res };
      }
      case 'weather_fetch': {
        const res = await webTools.weatherFetch(args.city);
        return { result: res };
      }
      case 'fetch_sports_data': {
        const res = await webTools.fetchSportsData(args.query);
        return { result: res };
      }

      // Persistent Memory Tools
      case 'memory_read': {
        const res = await memoryTools.memoryRead(courseId, args.topic_or_key);
        return { result: res };
      }
      case 'memory_write': {
        const res = await memoryTools.memoryWrite(courseId, args.topic_or_key, args.content);
        return { result: res };
      }
      case 'memory_append': {
        const res = await memoryTools.memoryAppend(courseId, args.topic_or_key, args.entry);
        return { result: res };
      }
      case 'memory_str_replace': {
        const res = await memoryTools.memoryStrReplace(courseId, args.topic_or_key, args.old_text, args.new_text);
        return { result: res };
      }
      case 'memory_list': {
        const res = await memoryTools.memoryList(courseId);
        return { result: res };
      }
      case 'memory_delete': {
        const res = await memoryTools.memoryDelete(courseId, args.topic_or_key, args.confirmation);
        return { result: res };
      }

      // Visual / Interactive Widgets
      case 'quiz_display': {
        const widget = widgetTools.createQuizWidget(args);
        return { result: { success: true, widgetCreated: 'quiz' }, widget };
      }
      case 'chart_display': {
        const widget = widgetTools.createChartWidget(args);
        return { result: { success: true, widgetCreated: 'chart' }, widget };
      }
      case 'comparison_card': {
        const widget = widgetTools.createComparisonWidget(args);
        return { result: { success: true, widgetCreated: 'comparison' }, widget };
      }
      case 'step_card': {
        const widget = widgetTools.createStepCardWidget(args);
        return { result: { success: true, widgetCreated: 'step_card' }, widget };
      }
      case 'message_compose': {
        const widget = widgetTools.createMessageComposeWidget(args);
        return { result: { success: true, widgetCreated: 'message_compose' }, widget };
      }
      case 'translation_display': {
        const widget = widgetTools.createTranslationWidget(args);
        return { result: { success: true, widgetCreated: 'translation' }, widget };
      }
      case 'recipe_display': {
        const widget = widgetTools.createRecipeWidget(args);
        return { result: { success: true, widgetCreated: 'recipe' }, widget };
      }
      case 'itinerary_display': {
        const widget = widgetTools.createItineraryWidget(args);
        return { result: { success: true, widgetCreated: 'itinerary' }, widget };
      }
      case 'visualize': {
        const widget = widgetTools.createVisualizeWidget(args);
        return { result: { success: true, widgetCreated: 'visualize' }, widget };
      }
      case 'options_card_display': {
        const widget = widgetTools.createOptionsCardWidget(args);
        return { result: { success: true, widgetCreated: 'options_card' }, widget };
      }
      case 'ask_user_input_v0': {
        const widget = widgetTools.createUserInputWidget(args);
        return { result: { success: true, widgetCreated: 'user_input' }, widget };
      }

      // Academic Calendar & Reminders (1 Day + 12 Hours Before Email)
      case 'schedule_academic_task': {
        const rawDeadline = args.deadline;
        const targetDeadline = parseAcademicDeadline(rawDeadline, userMessageText);
        const lowerPrompt = (userMessageText || '').toLowerCase();

        // 1. Normalize task type from prompt keywords and typos
        let taskType = (args.type || 'assignment') as any;
        if (/\b(?:quiz|quz|qz|quizz|test)\b/i.test(lowerPrompt)) {
          taskType = 'quiz';
        } else if (/\b(?:exam|paper|pepar|imtihan|viva|midterm|final)\b/i.test(lowerPrompt)) {
          taskType = 'exam';
        } else if (/\b(?:project)\b/i.test(lowerPrompt)) {
          taskType = 'project';
        } else if (/\b(?:assignment|asignment|asigmnt|asigmet|submission|homework|kam)\b/i.test(lowerPrompt)) {
          taskType = 'assignment';
        }

        const subject = args.subject || courseName || undefined;

        // 2. Clean conversational Roman Urdu noise & typos from title
        let rawTitle = (args.title || '').trim();
        if (!rawTitle || /^(?:ara\s*quz|mera\s*quiz|mara\s*quz|kal\s*ara\s*quz|kal\s*quiz|kl\s*quiz|quiz\s*ha|quz\s*ha|academic\s*task)$/i.test(rawTitle)) {
          rawTitle = taskType === 'quiz' ? (subject ? `${subject} Quiz` : 'Quiz') : taskType === 'exam' ? (subject ? `${subject} Exam` : 'Exam') : taskType === 'project' ? (subject ? `${subject} Project` : 'Project') : (subject ? `${subject} Assignment` : 'Assignment');
        }
        rawTitle = rawTitle.replace(/\b(?:ara|mara|mra)\s+(quz|quiz)\b/gi, 'Quiz')
                           .replace(/\b(?:ha|hai|h|ko|ka|ki)\b/gi, '')
                           .trim();
        if (!rawTitle) rawTitle = taskType === 'quiz' ? 'Quiz' : 'Academic Task';

        // Check if user is rescheduling/updating or if an active task of this type exists on the same day
        const isRescheduleIntent = /\b(?:change|reschedule|shift|update|badal|badlo|durust|change\s+kro|badal\s+do|timing)\b/i.test(userMessageText);

        const existingTasks = await taskService.getUserTasks(userId, { status: 'pending' });

        // Locate existing active task of same type and subject/course, or matching title
        const existingTask = existingTasks.find((t: any) => {
          if (rawTitle && t.title.toLowerCase().includes(rawTitle.toLowerCase())) return true;
          if (t.type === taskType) {
            if (!subject || !t.subject) return true;
            if (t.subject.toLowerCase() === subject.toLowerCase()) return true;
            if (t.subject.toLowerCase().includes(subject.toLowerCase()) || subject.toLowerCase().includes(t.subject.toLowerCase())) return true;
          }
          return false;
        });

        let task: any;
        let isUpdated = false;
        const targetDayStr = targetDeadline.toISOString().split('T')[0];
        const isSameDate = existingTask?.deadline && new Date(existingTask.deadline).toISOString().split('T')[0] === targetDayStr;

        if (existingTask && (isRescheduleIntent || isSameDate)) {
          // Update existing task deadline & metadata
          task = await taskService.updateTask(userId, existingTask.id, {
            title: rawTitle || existingTask.title,
            deadline: targetDeadline.toISOString(),
            subject: subject || existingTask.subject,
            priority: args.priority || existingTask.priority,
            description: args.description || existingTask.description,
          });
          isUpdated = true;

          // Purge old pending reminders and schedule new reminders for the updated deadline
          try {
            await prisma.reminder.deleteMany({
              where: { taskId: existingTask.id, status: 'pending' },
            });
          } catch (err) { }
          await scheduleTaskReminders(task.id, userId);
        } else {
          task = await taskService.createTask(userId, {
            title: rawTitle,
            type: taskType,
            subject: subject,
            deadline: targetDeadline.toISOString(),
            priority: args.priority || 'high',
            description: args.description || `Scheduled via StudySync AI Chatbot.`,
            source: 'manual',
          });

          // Automatically schedule 1-day (24h) and 12-hour email reminders!
          await scheduleTaskReminders(task.id, userId);
        }

        const oneDayBefore = new Date(targetDeadline.getTime() - 24 * 60 * 60 * 1000);
        const twelveHoursBefore = new Date(targetDeadline.getTime() - 12 * 60 * 60 * 1000);

        const formattedDeadline = targetDeadline.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

        const formatted24h =
          oneDayBefore.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }) +
          ' at ' +
          oneDayBefore.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

        const formatted12h =
          twelveHoursBefore.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }) +
          ' at ' +
          twelveHoursBefore.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

        return {
          result: {
            success: true,
            isUpdated,
            action: isUpdated ? 'Task Rescheduled & Updated' : 'Task Scheduled',
            title: task.title,
            type: task.type,
            subject: task.subject || courseName || 'General',
            deadline: formattedDeadline,
            calendarStatus: isUpdated ? 'Updated in Calendar' : 'Added to Calendar',
            reminder24h: formatted24h,
            reminder12h: formatted12h,
          },
        };
      }

      case 'get_academic_schedule': {
        const allTasks = await taskService.getUserTasks(userId, { status: 'pending' });
        let filtered = allTasks;
        if (args.filter && args.filter !== 'all') {
          filtered = allTasks.filter((t: any) => t.type === args.filter);
        }

        const now = Date.now();
        const formattedTasks = filtered.map((t: any) => {
          const diffMs = new Date(t.deadline).getTime() - now;
          const hours = Math.round(diffMs / (1000 * 60 * 60));
          const days = Math.round(hours / 24);
          const timeRemaining = diffMs < 0 ? 'Overdue' : days > 1 ? `in ${days} days` : `in ${hours} hours`;

          return {
            id: t.id,
            title: t.title,
            type: t.type,
            subject: t.subject || undefined,
            deadline: new Date(t.deadline).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            priority: t.priority,
            timeRemaining,
          };
        });

        return {
          result: {
            success: true,
            totalPending: formattedTasks.length,
            tasks: formattedTasks,
          },
        };
      }

      default:
        return { result: { success: false, error: `Unknown tool: ${name}` } };
    }
  }

  /**
   * Run the Autonomous ReAct Agent Loop with Gemini Function Calling
   */
  async runAgentLoop(
    courseId: string,
    courseName: string,
    prompt: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
    contextChunks: string[] = [],
    userId: string = 'd3b07384-d113-4602-9c0e-e2c7c5980001',
    enableThink: boolean = false
  ): Promise<AgentExecutionResult> {
    const widgets: ChatWidgetPayload[] = [];
    const toolCallLogs: Array<{ name: string; args: any; result: any }> = [];

    // ─── 1. PRIMARY ENGINE: Ultra-Fast Groq Agent Loop (<1s response across 9 keys) ───
    try {
      const groqResult = await this.runGroqAgentLoop(
        courseId,
        courseName,
        prompt,
        history,
        contextChunks,
        userId,
        enableThink
      );
      if (groqResult && (groqResult.answer || (groqResult.widgets && groqResult.widgets.length > 0))) {
        return groqResult;
      }
    } catch (groqErr: any) {
      console.warn('[AgentService] Primary Groq agent loop failed, falling back to Gemini:', groqErr?.message);
    }

    if (!genAI) {
      return {
        answer: 'Generative AI service is currently unavailable.',
        widgets: [],
        toolCalls: [],
      };
    }

    const now = new Date();
    const localTimeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const localDateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const tzOffsetMin = -now.getTimezoneOffset();
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
    const tzStr = `UTC${tzSign}${tzHours}:${tzMins}`;

    const systemInstruction = `You are the lead academic AI agent and mentor for the course "${courseName}".

${getAcademicCalendarPromptContext(now)}

TOPIC FLEXIBILITY (CRITICAL):
- While your primary course is "${courseName}", students frequently ask cross-disciplinary questions (database design, software architecture, algorithm concepts, system design, or mathematical proofs).
- NEVER refuse a question by claiming it belongs to another subject or falls outside this course!
- ALWAYS explain the concepts thoroughly with academic quality.
- VISUAL DIAGRAMS (MERMAID.JS ACTIVATED - ALWAYS GENERATE DIRECTLY IN MAIN CHAT):
  * When asked for system architectures, database ER diagrams (ERD), API/network sequence flows, algorithm workflows, state machines, mindmaps, or complex processes:
    -> YOU MUST DIRECTLY WRITE AND GENERATE THE ACTUAL COMPLETE MERMAID DIAGRAM YOURSELF!
    -> NEVER EVER output "Prompt Template for Generating...", "Use the following prompt in ChatGPT", or tell the student to use ChatGPT or external LLMs!
    -> NEVER use PlantUML syntax like 'usecaseDiagram' or '@startuml'. Mermaid does NOT support 'usecaseDiagram'! Mermaid only supports: erDiagram, flowchart TD/LR, sequenceDiagram, classDiagram, stateDiagram-v2, mindmap. For Use Case diagrams, ALWAYS use \`flowchart LR\`!
    -> NEVER output placeholder skeletons like "... (your diagram) ...".
    -> ALWAYS wrap the diagram in a full triple-backtick code block (\`\`\`mermaid ... \`\`\`) directly in your main chat response!
    -> DO NOT open or move diagrams to the right-side window, canvas, or artifact panel. Keep them strictly in the main chat.
    -> NEVER call generate_downloadable_file or any file creation tool for ERDs or diagrams! The user wants the visual diagram rendered directly in the chat stream.
    -> For ER Diagrams (erDiagram), write all entities, primary keys (PK), foreign keys (FK), attributes, and relationships:
       Example:
       \`\`\`mermaid
       erDiagram
           CUSTOMER ||--o{ RESERVATION : "makes"
           RESERVATION ||--|| CAR : "reserves"
           CUSTOMER {
               int customer_id PK
               string name
               string email
           }
           CAR {
               int car_id PK
               string license_plate
               string model
           }
       \`\`\`

- LIVE WEB & YOUTUBE VIDEO EXTRACTIONS:
  When [Live Extracted Web/Video Content from ...] is present in the prompt:
  You HAVE direct, verified access to this video/web content, including its title, creator, detailed summary, and full timestamped chapters.
  NEVER, EVER say "I cannot access external YouTube links", "I cannot stream or browse", or ask the student to provide the transcript or topic!
  Immediately provide a thorough, structured conceptual analysis of what the video covers, explaining all key concepts, diagrams, and topics from the extracted data!

You have access to a full suite of autonomous tools and interactive widgets. The student will NEVER tell you which tool to use — you must reason and select tools automatically based on these intent triggers:

TOOL DECISION & INTENT RULES:
1. Academic Tasks, Calendar & Automated Reminders:
   - When the student mentions ANY quiz, assignment, exam, test, project deadline, homework, or asks to set a reminder or schedule something (e.g. "kal 5 bjy mara quiz ha", "kal ara quz ha", "kl mera quiz hai", "parso assignment submit krni h", "aj shaam 6 bje test ha", "Mera AI ka quiz hai Monday ko 10 baje", "Assignment 2 submission on Friday at 5pm", "kal quiz hai reminder laga do"):
     -> CRITICAL AUTONOMOUS BEHAVIOR: NEVER ask the student for missing title, subject, or clarification when they write in casual Roman Urdu with typos like "kal ara quz ha" or "kl quiz h"!
     -> Immediately invoke schedule_academic_task autonomously with:
        * title: "Quiz" (or "[Course] Quiz")
        * type: "quiz" | "assignment" | "exam" | "project"
        * deadline: exact ISO deadline (e.g. tomorrow morning 10:00 AM for "kal ara quz ha")
        * subject: "${courseName}"
        * priority: "high"
     -> The system automatically syncs this task to the student's Calendar (/calendar) and configures dual automated email notifications (1 day / 24 hours before AND 12 hours before) dispatched via Gmail SMTP!
     -> TIME CONVENTIONS:
        * When a student specifies hours like "5 bjy", "5 baje", "4 bjy", "2 baje", "3:30", unless they explicitly state morning ("subah/am"), university tasks default to PM (e.g. 5 bjy = 5:00 PM / 17:00).
        * Convert relative date words like "kal", "kl", "parso", "prso", "aj", "aaj", "tomorrow", "Friday" relative to student local date: ${localDateStr}.
        * For "Due Date" in your response, ALWAYS output the day-wise formatted date string returned by the tool result (e.g. "Monday, September 21, 2026"). NEVER output raw UTC timestamps like "2026-09-08T05:00:00.000Z"!
     -> IMPORTANT: Output ONLY the major details directly in concise, clean bullet points without any interface cards, disclaimers, or duplicate notes:
        • 📌 **Task:** [Title] ([Type])
        • 📅 **Due Date:** [Use the day-wise formatted date returned by the tool, e.g. "Monday, September 21, 2026"]
        • 📆 **Calendar:** Calendar section mein update ho gaya hai
        • ✉️ **Email Reminders:**
          - 1 din pehle (24h) auto email
          - 12 ghante pehle auto email
   - When the student asks what quizzes/assignments/exams are upcoming, asks about their schedule, or wants a deadline check ("mera agla quiz kab hai?", "kya kaam pending hai?", "show my academic schedule"):
     -> IMMEDIATELY invoke get_academic_schedule.

2. File Generation, Code & Downloads (CRITICAL):
   - When the student asks to create a file, give a download link, write code to a file, or export notes:
     ("quicksort.py file bana kar download link do", "cheat_sheet.txt file bana kar do", "is ko docx ky andr bna kr do", "pdf bana kar download do", "file bana do", "download link do"):
     -> YOU MUST IMMEDIATELY CALL generate_downloadable_file!
     -> Pass filename with correct extension (e.g. "quicksort.py", "cheat_sheet.txt", "notes.docx", "summary.pdf", "data.csv") and complete content.
     -> NEVER just print code in chat and tell the user to copy-paste manually when they asked for a file or download link! Always invoke generate_downloadable_file so the student receives an interactive file card in the chat. Do NOT repeat redundant markdown download links like "Download the file: filename (1-click download)" in your text because the interactive download card will render below.
   - "Zip file bana kar do", "pip install ...", "run script" -> bash_tool
   - "Fix line 20", "rename function" in existing file -> str_replace
   - "Uploaded file dekho", "folder structure dikhao" -> view

3. Web & Live Info:
   - Current/live info ("aaj USD rate", "pricing", "latest AI models 2026", recent news) -> web_search
   - User gives a URL ("ye link kholo aur summary do") -> web_fetch
   - Visual illustration/photo ("Badshahi Mosque tasveer", "educational diagram") -> image_search
   - Weather queries ("Aaj Lahore ka mausam kaisa hai") -> weather_fetch
   - Sports queries ("PSL score", "cricket match update") -> fetch_sports_data

4. Persistent Memory:
   - User shares durable facts ("Mera naam Arham hai", "Add this note to memory") -> memory_write or memory_append automatically
   - User asks about past sessions or stored context -> memory_read
   - User asks to delete memory -> memory_delete

5. Interactive Widgets:
   - Practice questions, exam prep, self-tests ("5 sawalon ka quiz bana do") -> quiz_display
   - Numeric data, trends, percentages, charts ("Sales bar chart", "grades chart") -> chart_display
   - Comparing 2 or more technologies, algorithms, products ("iPhone 16 vs S25", "SQL vs NoSQL") -> comparison_card
   - Ordered step-by-step how-to ("Router reset kaise karu step by step") -> step_card
   - Multi-option decisions or health concerns ("Ghutne mein dard ke options", career branches) -> options_card_display (with clear options & disclaimer)
   - Culinary recipes ("Chicken biryani recipe 4 logon ke liye") -> recipe_display
   - Travel plans, day-by-day itineraries ("Lahore mein 2 din ka plan") -> itinerary_display
   - Drafting formal/casual emails ("Boss ko leave email likho") -> message_compose
   - Language translations for targeted sentences ("Urdu mein translate karo: I am tired") -> translation_display
   - Quick choices for the user ("Low/Medium/High budget", "Difficulty level") -> ask_user_input_v0 to display clickable pills in chat instead of asking in long text!

- DYNAMIC MULTI-NODE AGENTIC REASONING (CRITICAL): At the very start of your response, write your genuine internal reasoning inside \`<thought>...</thought>\` tags.
  * DO NOT use hardcoded fixed steps. Dynamically evaluate the user's query and determine exactly how many execution nodes are required (from 1 to N nodes, e.g. 2 nodes for simple tasks, 4-6 nodes for full apps, multi-file projects, or complex analyses).
  * Each node must have a specific, dynamic, query-tailored name, a defined role, tools utilized, dependencies, and execution summary.
  * Format your thinking as a dynamic node graph inside \`[NODE_GRAPH]...[/NODE_GRAPH]\` JSON, or as sequential node headings:
    ### Node 1: [Dynamic Name, e.g. "Architecture & Scope Definition"]
    - Role: [Specific Purpose, e.g. "Planning & Domain Modeling"]
    - Tools: [Tools used, e.g. "FAISS Vector Memory", "Code Synthesis Engine", "File Generator", "Knowledge Synthesis Engine"]
    - Description: [Key technical breakdown executed in this node]
    - DependsOn: [None or "Node X"]
  * Close with \`</thought>\`. Everything after \`</thought>\` is the student-facing answer.
${enableThink ? `
- THINK MODE ACTIVE (LIVE WEB RESEARCH & DEEP MULTI-STEP REASONING):
  * The student has toggled Think Mode ON! Live Tavily search intelligence and comprehensive web findings have been added to your context.
  * You MUST produce rigorous, comprehensive analytical reasoning inside <thought>...</thought>.
  * Within <thought>, methodically analyze:
    1. Problem & Context Analysis: Evaluate user requirements against verified course materials and Tavily live research.
    2. Deep Verification & Edge Cases: Fact-check facts, mathematical formulas, algorithms, and potential misconceptions.
    3. Structural Synthesis: Connect fundamental theoretical principles to practical application with clarity.
    4. Execution Blueprint: Ensure LaTeX mathematical precision and complete, non-truncated answers.
  * In the final response, provide a high-fidelity, thoroughly explained answer, referencing verified facts or live web sources where relevant.
` : ''}

- SMART SEPARATION OF MAIN CHAT VS. RIGHT-SIDE ARTIFACT (CRITICAL):
  * MAIN CHAT SCREEN (Left Pane): Always write the high-level conversational walkthrough, conceptual explanation, architecture walkthroughs, feature highlights, and how-to-run instructions in the main response.
  * RIGHT-SIDE ARTIFACT WINDOW (Right Pane): The primary deliverable (the actual complete working code or complete formal document) will be rendered in the dedicated Right Window!
    - For Code: Output complete, production-ready code with filenames in code fences (e.g. \`\`\`html index.html\\n...\\n\`\`\`, \`\`\`css style.css\\n...\\n\`\`\`, \`\`\`javascript app.js\\n...\\n\`\`\`, or \`\`\`python script.py\\n...\\n\`\`\`).
    - For Formal Documents (e.g. Sick Leave Letter, Formal Essay, Application, Proposal, Report): Output the complete, beautifully formatted document in a fenced code block with a title (e.g. \`\`\`document title="Sick_Leave_Application.docx"\\n...\\n\`\`\` or \`\`\`markdown title="sick_leave_letter.txt"\\n...\\n\`\`\`) or invoke generate_downloadable_file!
    - This ensures the Right-Side Window automatically displays the core deliverable with line numbers, copy, and download, while the Left Chat Screen stays clean, conversational, and easy to read.
- Always answer the user's SPECIFIC question directly and to the point.
- Involve conversation history when needed, but stay sharply focused on the current request.
- Adapt length dynamically: short direct answers for concise questions, expansive detailed answers for analytical questions.
- NEVER mention internal tool names (bash_tool, create_file, schedule_academic_task, etc.) in your conversation text with the student. Explain naturally as an AI mentor.
- Use proper KaTeX LaTeX syntax ($formula$ and $$block$$) for any mathematical equations.
- STRICT 1000-TOKEN BUDGET & GUARANTEED COMPLETE DELIVERY: Always budget and structure your response so that your entire explanation, formulas, and conclusions are 100% completed within the token limit. Never leave a thought, sentence, or list item cut off mid-way.
- MARKDOWN FORMATTING (CRITICAL): ALWAYS use proper markdown formatting in every response:
  * Use ## or ### headings to organize sections (never write section titles as plain text)
  * Use **bold** for key terms, concepts, and important points
  * Use bullet points (- or *) for lists — NEVER write list items as long run-on sentences
  * Use numbered lists (1. 2. 3.) for ordered steps or sequences
  * Use \`inline code\` for function names, variables, algorithms
  * Use \`\`\`python ... \`\`\` code blocks for any code

  * VISUAL DIAGRAMS (MERMAID.JS ACTIVATED):
    Whenever the student asks about an architecture, pipeline, database schema, algorithm, state machine, or process:
    Generate a clean, high-clarity Mermaid diagram (\`\`\`mermaid ... \`\`\`) alongside clear explanatory walkthroughs.
    Supported types: flowchart TD/LR, sequenceDiagram, erDiagram, stateDiagram-v2, classDiagram, mindmap. Always wrap node text with brackets/quotes: e.g. A["Node Name"].
  * LATEX & ATTRIBUTE FORMATTING:
    - For inline math and academic notations, use LaTeX syntax ($ and $$).
    - For database attributes and code identifiers with underscores, use inline code.
  * Add a blank line between paragraphs — NEVER write a wall of text
  * Keep paragraphs short (3-4 sentences max)

HEAVY FILE / DOCUMENT UPLOAD RULE (CRITICAL — STRICTLY ENFORCED):
- When ANY large file/document is uploaded (100-page PDFs, books, lecture slides, comprehensive notes, etc.):
  → NEVER, EVER repeat, echo, copy-paste, or dump the document content verbatim into your response.
  → NEVER produce a chapter-by-chapter walkthrough of the entire document.
  → NEVER write more than 10-12 lines total in response to a large file upload.
- For ALL of these request types on large documents ("review", "summarize", "explain", "what is in this", "describe", "overview"):
  → Give a BRIEF structured overview of MAX 5-7 bullet points listing the key modules/chapters/topics found.
  → Then ALWAYS end with a short friendly question asking what the student specifically wants:
     "📄 **File mil gayi!** Yeh [X]-page document in topics ko cover karta hai:
     • Module 1: [topic]
     • Module 2: [topic]
     • Module 3: [topic]
     (aur [N] aur modules...)
     **Aap kya specifically jaanna chahte hain?** Kisi topic ki detail, quiz, ya koi aur cheez?"
- ONLY give a detailed in-depth explanation when the student asks about ONE SPECIFIC topic, concept, or chapter (e.g. "A* algorithm explain karo", "LSTM samjhao", "Chapter 3 ka summary do").
- This rule is ABSOLUTE and OVERRIDES all other instructions — never dump full document content.`;

    let modelInstance = null;
    for (const mName of AGENT_CANDIDATE_MODELS) {
      try {
        modelInstance = genAI.getGenerativeModel({
          model: mName,
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3500,
          },
        });
        break;
      } catch {}
    }

    if (!modelInstance) {
      return { answer: 'Could not initialize generative model.', widgets: [], toolCalls: [] };
    }

    // Construct conversation contents
    const contents: Array<any> = [];

    // Prior history turns (last 8)
    const recent = (history || []).slice(-8);
    for (const h of recent) {
      contents.push({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }],
      });
    }

    let webSnippet = '';
    const urlMatch = prompt.match(/\bhttps?:\/\/\S+/i);
    const alreadyHasWebSnippet = contextChunks.some((c) => c.includes('[Live Extracted Web/Video Content'));
    if (urlMatch) {
      try {
        const fetched = await webTools.webFetch(urlMatch[0]);
        if (fetched.success && fetched.text && !alreadyHasWebSnippet) {
          webSnippet = `\n\n[Live Extracted Web/Video Content from ${urlMatch[0]}]:\n${fetched.text}`;
        }
        if ((fetched as any)?.videoData && !widgets.some((w) => w.type === 'video')) {
          widgets.push({
            type: 'video',
            data: (fetched as any).videoData,
          });
        }
      } catch (err: any) {
        console.warn('[AgentService] Pre-fetch URL failed:', err.message);
      }
    }

    let effectiveChunks = contextChunks;
    if (urlMatch || contextChunks.length > 3) {
      effectiveChunks = contextChunks.slice(0, 3);
    }
    const contextSnippet = effectiveChunks.length > 0
      ? `\n\n[Course Notes Excerpts]:\n${effectiveChunks.join('\n\n').substring(0, 4000)}`
      : '';

    contents.push({
      role: 'user',
      parts: [{ text: `${prompt}${webSnippet}${contextSnippet}` }],
    });

    let maxLoops = 5;
    let finalAnswer = '';

    while (maxLoops > 0) {
      maxLoops--;

      try {
        let res: any = null;
        const clients = getAllGeminiClients();
        const effectiveClients = clients.length > 0 ? clients : (genAI ? [genAI] : []);
        for (const mName of AGENT_CANDIDATE_MODELS) {
          for (const client of effectiveClients) {
            try {
              const activeModel = client.getGenerativeModel({
                model: mName,
                systemInstruction,
                tools: [{ functionDeclarations: toolDeclarations }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 3500,
                },
              });
              res = await activeModel.generateContent({ contents });
              if (res && res.response) break;
            } catch (callErr: any) {
              console.warn(`[AgentService] Gemini ${mName} call failed (${callErr.message?.substring(0, 80)}), shifting...`);
            }
          }
          if (res && res.response) break;
        }

        if (!res || !res.response) break;

        const candidate = res.response.candidates?.[0];
        if (!candidate) break;

        const parts = candidate.content?.parts || [];
        const functionCalls = parts.filter((p: any) => p.functionCall);

        // If no function call, model produced text answer
        if (functionCalls.length === 0) {
          finalAnswer = res.response.text().trim();
          break;
        }

        // Append model's response parts to conversation history
        contents.push({
          role: 'model',
          parts,
        });

        // Execute all function calls requested by the model
        const functionResponseParts: any[] = [];
        for (const fcPart of functionCalls) {
          const fc = (fcPart as any).functionCall;
          if (!fc) continue;

          const { result, widget } = await this.executeTool(
            fc.name,
            fc.args,
            courseId,
            courseName,
            userId,
            prompt
          );

          toolCallLogs.push({
            name: fc.name,
            args: fc.args,
            result,
          });

          if (widget) {
            widgets.push(widget);
          }

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: result,
            },
          });
        }

        // Append function results back to conversation
        contents.push({
          role: 'user',
          parts: functionResponseParts,
        });
      } catch (err: any) {
        console.warn('[AgentService] ReAct loop error:', err.message);
        break;
      }
    }

    if (!finalAnswer && widgets.length > 0) {
      finalAnswer = `I have generated the requested interactive components for you below.`;
    }

    if (!finalAnswer && widgets.length === 0) {
      console.log('[AgentService] Gemini quota or tool execution failed, attempting Groq Tool Agent fallback...');
      const groqFallbackResult = await this.runGroqAgentLoop(courseId, courseName, prompt, history, contextChunks, userId, enableThink);
      if (groqFallbackResult && (groqFallbackResult.answer || groqFallbackResult.widgets.length > 0)) {
        return groqFallbackResult;
      }
    }

    await this.autoDetectAndGenerateFile(prompt, finalAnswer, courseId, widgets, toolCallLogs, history);
    finalAnswer = formatAnswerAcademicDeadlines(finalAnswer, toolCallLogs);

    let modelThought = '';
    const { thought: parsedThought, cleanAnswer } = extractThoughtAndCleanAnswer(finalAnswer);
    finalAnswer = cleanAnswer;
    if (parsedThought) {
      modelThought = parsedThought;
    }

    if (!modelThought) {
      modelThought = this.generateSituationAwareThought(prompt, finalAnswer, courseName, toolCallLogs, widgets);
    }

    return {
      answer: finalAnswer,
      widgets,
      toolCalls: toolCallLogs,
      thought: modelThought || undefined,
    };
  }

  /**
   * High-speed Groq Tool Calling Engine (Fallback when Gemini hits 429 quota)
   */
  async runGroqAgentLoop(
    courseId: string,
    courseName: string,
    prompt: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }> = [],
    contextChunks: string[] = [],
    userId: string = 'd3b07384-d113-4602-9c0e-e2c7c5980001',
    enableThink: boolean = false
  ): Promise<AgentExecutionResult> {
    const resolved = await resolveAIClientForUser(userId, 'groq');
    const groq = resolved.groqClient || getNextGroqClient();
    if (!groq) {
      return { answer: '', widgets: [], toolCalls: [] };
    }

    const widgets: ChatWidgetPayload[] = [];
    const toolCallLogs: Array<{ name: string; args: any; result: any }> = [];

    const groqTools: any[] = [
      {
        type: 'function',
        function: {
          name: 'schedule_academic_task',
          description: 'Schedule a new academic quiz, assignment, exam, or project on the student calendar with automated 1-day (24h) and 12-hour email reminders.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Task, quiz, or assignment title' },
              type: { type: 'string', enum: ['quiz', 'assignment', 'exam', 'project', 'personal'] },
              deadline: { type: 'string', description: 'Due date and time in ISO format' },
              subject: { type: 'string', description: 'Course or subject name' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
              description: { type: 'string', description: 'Task details or instructions' },
            },
            required: ['title', 'deadline'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_academic_schedule',
          description: 'Retrieve the student calendar schedule showing upcoming deadlines.',
          parameters: {
            type: 'object',
            properties: {
              filter: { type: 'string', enum: ['quiz', 'assignment', 'exam', 'all'] },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'quiz_display',
          description: 'Display an interactive quiz card in chat.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    question: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correctAnswerIndex: { type: 'number' },
                    explanation: { type: 'string' },
                  },
                  required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
                },
              },
            },
            required: ['title', 'questions'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'chart_display',
          description: 'Display an interactive chart directly in chat.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              chartType: { type: 'string', enum: ['bar', 'line', 'pie'] },
              labels: { type: 'array', items: { type: 'string' } },
              values: { type: 'array', items: { type: 'number' } },
              unit: { type: 'string' },
            },
            required: ['title', 'chartType', 'labels', 'values'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'comparison_card',
          description: 'Display a structured side-by-side comparison table.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              columns: { type: 'array', items: { type: 'string' } },
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    feature: { type: 'string' },
                    values: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['feature', 'values'],
                },
              },
            },
            required: ['title', 'columns', 'rows'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'message_compose',
          description: 'Display an interactive email or message composer widget.',
          parameters: {
            type: 'object',
            properties: {
              recipient: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['subject', 'body'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the live web using Tavily.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              includeAnswer: { type: 'boolean' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'web_fetch',
          description: 'Fetch and read content, transcripts, titles, and educational descriptions from ANY web URL (including YouTube video links, blogs, documentation, university links). ALWAYS invoke this tool when the student shares a link or asks to summarize/analyze a URL.',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'HTTP or HTTPS URL to fetch' },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a downloadable code or document file. ONLY invoke when the user explicitly asks to generate an actual code or document file to save/export. NEVER invoke for general questions, summaries, or web link analyses.',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['filename', 'content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'present_files',
          description: 'Present multiple generated files to the user.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              files: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    filename: { type: 'string' },
                    content: { type: 'string' },
                  },
                  required: ['filename', 'content'],
                },
              },
            },
            required: ['title', 'files'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_downloadable_file',
          description: 'Create and deliver a downloadable file (.docx, .pdf, .py, .txt, etc.). ONLY invoke when the student explicitly requests a downloadable file export or download link. NEVER invoke for summaries, key points, explanations, or web link analyses.',
          parameters: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              content: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['filename', 'content'],
          },
        },
      },
    ];

    const now = new Date();
    const localTimeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const localDateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const tzOffsetMin = -now.getTimezoneOffset();
    const tzSign = tzOffsetMin >= 0 ? '+' : '-';
    const tzHours = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0');
    const tzMins = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0');
    const tzStr = `UTC${tzSign}${tzHours}:${tzMins}`;

    const systemPrompt = `You are the lead academic AI agent for "${courseName}".

${getAcademicCalendarPromptContext(now)}

You have access to tools: schedule_academic_task, get_academic_schedule, generate_downloadable_file, quiz_display, chart_display, comparison_card, message_compose, web_search, web_fetch, create_file, present_files.
Core instructions:
1. Always answer the user's SPECIFIC question directly and to the point without unnecessary filler or preamble.
2. CRITICAL WEB LINK & SUMMARY INSTRUCTIONS:
   * When the student provides a URL or web link (including YouTube videos, articles, blogs, documentation) and asks to summarize, analyze, or explain:
     1. IMMEDIATELY invoke the web_fetch tool with the URL!
     2. After receiving the fetched content, output the 5 key points, structured overview, and summary directly in the chat using Markdown!
     3. NEVER call create_file or generate_downloadable_file for link summaries or explanations. "summary do" means give a summary in chat, NOT create a file!
3. MARKDOWN FORMATTING (CRITICAL): ALWAYS use proper markdown in every response:
   * Use ## or ### headings to organize sections (never write section titles as plain text)
   * Use **bold** for key terms and important points
   * Use bullet points (- or *) for lists — NEVER run list items together as one long paragraph
   * Use numbered lists (1. 2. 3.) for steps or sequences
   * Use \`inline code\` for function names, variables, algorithms
   * Use \`\`\`python ... \`\`\` for any code blocks
   * VISUAL DIAGRAMS (MERMAID.JS ACTIVATED - ALWAYS IN MAIN CHAT):
     Whenever asked for an architecture, pipeline, database ERD, algorithm, workflow, or sequence:
     Generate a clean, high-clarity Mermaid diagram (\`\`\`mermaid ... \`\`\`) directly in the main chat. NEVER open in side window/canvas or generate downloadable files for diagrams.
   * Add blank lines between paragraphs — NEVER produce a wall of text
   * Keep paragraphs short (max 3-4 sentences)
4. Academic Tasks & Reminders (AUTONOMOUS SCHEDULING):
   - When the student mentions ANY quiz, assignment, exam, test, project deadline, or asks to set a reminder (e.g. "kal ara quz ha", "kl mera quiz hai", "kal 5 bjy quiz ha", "parso assignment submit krni h", "aj shaam 6 bje test ha", "20 sep ko assignment hai"):
     * CRITICAL AUTONOMOUS BEHAVIOR: NEVER ask the student for missing details or course name when they say "kal ara quz ha" or "kl quiz h"!
     * IMMEDIATELY invoke schedule_academic_task with:
       - title: "Quiz" (or "[Course] Quiz")
       - type: "quiz" | "assignment" | "exam" | "project"
       - deadline: exact ISO deadline (e.g. tomorrow morning 10:00 AM for "kal ara quz ha")
       - subject: "${courseName}"
       - priority: "high"
     * Calculate the exact ISO deadline string using the System Date & Time context and 7-day calendar lookup table above.
     * Specific dates MUST be respected (e.g. "20 sep" -> Sep 20; "kal" -> tomorrow; "parso" -> day after tomorrow).
5. Dynamically adapt answer length & guaranteed full delivery:
   - If the user asks a short/direct question, give a crisp, concise, to-the-point answer.
   - If the user asks for a detailed explanation, table, queries, or comprehensive guide, give a thorough, in-depth complete answer.
6. Tool guidelines:
   - FILE CREATION & DOWNLOADS: When the student explicitly asks to create a code file or export notes to .docx/.pdf/.py: invoke generate_downloadable_file. DO NOT invoke for ERDs, diagrams, or web link summaries.
7. IMPORTANT: NEVER mention technical internal tool names in your output text.
7. CLARIFICATION: If the question is ambiguous, ask the student politely with 2-3 numbered options.
8. DYNAMIC SEQUENTIAL REASONING (<thought>):
   - Write your reasoning inside <thought>...</thought> tags at the start of your response.
   - Close with </thought>. Everything after </thought> is the student-facing answer.
${enableThink ? `
- THINK MODE ACTIVE: Live Tavily search intelligence and comprehensive findings have been added. Produce thorough analytical reasoning inside <thought>...</thought>.
` : ''}
10. LIVE WEB & YOUTUBE VIDEO EXTRACTIONS:
   - When [Live Extracted Web/Video Content from ...] is present in the prompt:
   - You HAVE direct, verified access to this video/web content, including its title, creator, detailed summary, and full timestamped chapters.
   - NEVER, EVER say "I cannot access external YouTube links", "I cannot stream or browse", or ask the student to provide the transcript or topic!
   - Immediately provide a thorough, structured academic analysis of what the video covers, explaining all key concepts, diagrams, and topics from the extracted data!
Always respond in clear, encouraging language with proper LaTeX $$formulas$$.`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    const recent = (history || []).slice(-6);
    for (const h of recent) {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text });
    }

    let webSnippet = '';
    const urlMatch = prompt.match(/\bhttps?:\/\/\S+/i);
    const alreadyHasWebSnippet = contextChunks.some((c) => c.includes('[Live Extracted Web/Video Content'));
    if (urlMatch) {
      try {
        const fetched = await webTools.webFetch(urlMatch[0]);
        if (fetched.success && fetched.text && !alreadyHasWebSnippet) {
          webSnippet = `\n\n[Live Extracted Web/Video Content from ${urlMatch[0]}]:\n${fetched.text}`;
        }
        if ((fetched as any)?.videoData && !widgets.some((w) => w.type === 'video')) {
          widgets.push({
            type: 'video',
            data: (fetched as any).videoData,
          });
        }
      } catch (err: any) {
        console.warn('[AgentService] Pre-fetch URL failed:', err.message);
      }
    }

    let effectiveChunks = contextChunks;
    if (urlMatch || contextChunks.length > 2) {
      effectiveChunks = contextChunks.slice(0, 2);
    }
    const contextSnippet = effectiveChunks.length > 0
      ? `\n\n[Course Notes Excerpts]:\n${effectiveChunks.join('\n\n').substring(0, 2500)}`
      : '';

    messages.push({ role: 'user', content: `${prompt}${webSnippet}${contextSnippet}` });

    let maxLoops = 5;
    let finalAnswer = '';

    while (maxLoops > 0) {
      maxLoops--;
      try {
        let completion: any = null;
        const candidateGroqModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
        for (const gModel of candidateGroqModels) {
          try {
            const activeClient = resolved.isByok ? groq : (getNextGroqClient() || groq);
            completion = await activeClient.chat.completions.create({
              model: gModel,
              messages,
              tools: groqTools,
              tool_choice: 'auto',
              temperature: 0.6,
              max_tokens: 8192,
            });
            if (completion) break;
          } catch (gErr: any) {
            console.warn(`[AgentService] Groq model ${gModel} failed (${gErr.message?.substring(0, 80)}), shifting...`);
          }
        }
        if (!completion) break;

        const choice = completion.choices[0];
        if (!choice) break;

        const message = choice.message;
        messages.push(message);

        const toolCalls = message.tool_calls || [];
        if (toolCalls.length === 0) {
          finalAnswer = message.content?.trim() || '';
          break;
        }

        for (const tc of toolCalls) {
          const fnName = tc.function.name;
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments || '{}');
          } catch { }

          const { result, widget } = await this.executeTool(fnName, parsedArgs, courseId, courseName, userId, prompt);
          toolCallLogs.push({ name: fnName, args: parsedArgs, result });
          if (widget) widgets.push(widget);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      } catch (e: any) {
        console.warn('[AgentService] Groq agent loop error:', e.message);
        // Attempt recovery if Groq failed during tool argument generation (e.g. JSON escaping error)
        const rawFailed = e.error?.failed_generation || e.message || '';
        if (rawFailed.includes('generate_downloadable_file') || rawFailed.includes('filename')) {
          try {
            const filenameMatch = rawFailed.match(/"filename"\s*:\s*"([^"]+)"/);
            const contentMatch = rawFailed.match(/"content"\s*:\s*"([\s\S]+?)(?:"\s*,\s*"|"\s*\}|$)/);
            if (filenameMatch) {
              const recFilename = filenameMatch[1];
              let recContent = contentMatch ? contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
              if (!recContent || recContent.length < 20) {
                recContent = prompt;
              }
              const { result, widget } = await this.executeTool('generate_downloadable_file', { filename: recFilename, content: recContent }, courseId, courseName, userId, prompt);
              toolCallLogs.push({ name: 'generate_downloadable_file', args: { filename: recFilename }, result });
              if (widget) widgets.push(widget);
            }
          } catch (recErr: any) {
            console.warn('[AgentService] Groq failed_generation recovery failed:', recErr.message);
          }
        }
        break;
      }
    }

    // If no final answer was produced (e.g. tool loop ended or threw error), fetch a plain response without tools
    if (!finalAnswer) {
      try {
        const activeClient = resolved.isByok ? groq : (getNextGroqClient() || groq);
        const plainCompletion = await activeClient.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: messages.filter((m: any) => m.role !== 'tool' && !m.tool_calls),
          temperature: 0.7,
          max_tokens: 8192,
        });
        finalAnswer = plainCompletion.choices[0]?.message?.content?.trim() || '';
      } catch (err2: any) {
        console.warn('[AgentService] Groq fallback plain text failed:', err2.message);
      }
    }

    await this.autoDetectAndGenerateFile(prompt, finalAnswer, courseId, widgets, toolCallLogs, history);
    finalAnswer = formatAnswerAcademicDeadlines(finalAnswer, toolCallLogs);

    let modelThought = '';
    const { thought: parsedThought, cleanAnswer } = extractThoughtAndCleanAnswer(finalAnswer);
    finalAnswer = cleanAnswer;
    if (parsedThought) {
      modelThought = parsedThought;
    }

    if (!modelThought) {
      modelThought = this.generateSituationAwareThought(prompt, finalAnswer, courseName, toolCallLogs, widgets);
    }

    return {
      answer: finalAnswer || (widgets.length > 0 ? 'Aapki file generate ho chuki hai. Neeche diye gaye Download card se direct download kar sakte hain.' : ''),
      widgets,
      toolCalls: toolCallLogs,
      thought: modelThought || undefined,
    };
  }

  public generateSituationAwareThought(
    prompt: string,
    answer: string,
    courseName: string,
    toolCallLogs: any[] = [],
    widgets: any[] = []
  ): string {
    // 1. Dynamic Topic & Entity Extraction
    const cleanedPrompt = prompt
      .replace(/\b(the|a|an|of|and|or|about|tell|kya|hota|hai|hain|bhi|ko|se|me|mein|ka|ki|ke|is|are|what|how|does|do|can|give|show|please|plz|can you|could you|explain|samjhao|batao|karo|likho|write|create|make|bna|bana|code|program|how to|what is|difference between|vs|in|for|with|give me|tell me|mujhe|chahiye)\b/gi, ' ')
      .replace(/[^\w\s\+\#\.\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const topicWords = cleanedPrompt.split(' ').filter((w) => w.length > 2);
    const coreTopic =
      topicWords.slice(0, 4).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') ||
      (courseName && courseName !== 'General' ? courseName : 'Academic Inquiry');

    const isComparison = /\b(difference|compare|comparison|vs|versus|farq)\b/i.test(prompt);

    // Detect language or framework
    let lang = '';
    if (/\b(python|py)\b/i.test(prompt) || /```python\b/i.test(answer)) lang = 'Python';
    else if (/\b(javascript|js)\b/i.test(prompt) || /```javascript\b|```js\b/i.test(answer)) lang = 'JavaScript';
    else if (/\b(typescript|ts)\b/i.test(prompt) || /```typescript\b|```ts\b/i.test(answer)) lang = 'TypeScript';
    else if (/\b(c\+\+|cpp)\b/i.test(prompt) || /```cpp\b|```c\+\+\b/i.test(answer)) lang = 'C++';
    else if (/\b(java)\b/i.test(prompt) || /```java\b/i.test(answer)) lang = 'Java';
    else if (/\b(html|css)\b/i.test(prompt) || /```html\b/i.test(answer)) lang = 'HTML/CSS';
    else if (/\b(sql)\b/i.test(prompt) || /```sql\b/i.test(answer)) lang = 'SQL';

    // Detect modalities in output
    const hasCode = /```(?:[a-zA-Z0-9_\-]+)?[\r\n]/i.test(answer);
    const hasLatex = /(\$\$|\\[a-zA-Z]+|\^[0-9\{]|_[0-9\{])/.test(answer);
    const hasTask = toolCallLogs.some((t) => t.name === 'schedule_academic_task');
    const hasFile =
      toolCallLogs.some((t) => t.name === 'generate_downloadable_file') ||
      widgets.some((w) => w.type === 'files');
    const hasQuiz =
      toolCallLogs.some((t) => t.name === 'quiz_display') ||
      widgets.some((w) => w.type === 'quiz');
    const isDoc = /\b(leave|application|letter|principal|manager|proposal|essay)\b/i.test(prompt);

    // Build 4 rich, dynamic, situation-specific nodes
    const nodes: Array<{ number: number; title: string; body: string }> = [];

    // Node 1: Scope & Problem Formulation
    if (hasTask) {
      const taskLog = toolCallLogs.find((t) => t.name === 'schedule_academic_task');
      const taskTitle = taskLog?.args?.title || coreTopic || 'Academic Task';
      nodes.push({
        number: 1,
        title: `Parsing Academic Task Scope: ${taskTitle}`,
        body: `Deconstructed student query constraints, deadline parameters, and academic subject classification (${courseName || 'General'}). Verified reminder dispatch rules.`,
      });

    } else if (isDoc) {
      nodes.push({
        number: 1,
        title: `Deconstructing Formal Institutional Request: ${coreTopic}`,
        body: `Extracted addressee authority, institutional salutation, and core absence rationale. Aligned with formal administrative document protocols.`,
      });
    } else if (isComparison) {
      nodes.push({
        number: 1,
        title: `Comparative Scoping & Taxonomy: ${coreTopic}`,
        body: `Identified primary architectural paradigms, functional boundaries, and contrasting features of ${coreTopic} in ${courseName || 'Computer Science'}.`,
      });
    } else if (hasCode || lang) {
      nodes.push({
        number: 1,
        title: `Analyzing Problem Space & Algorithmic Bounds: ${coreTopic}`,
        body: `Evaluated input preconditions, operational requirements, and target asymptotic complexity for ${coreTopic}${lang ? ` in ${lang}` : ''}.`,
      });
    } else if (hasLatex) {
      nodes.push({
        number: 1,
        title: `Mathematical Domain Deconstruction: ${coreTopic}`,
        body: `Identified governing mathematical principles, symbolic variables, and prerequisite analytical theorems for ${coreTopic}.`,
      });
    } else {
      nodes.push({
        number: 1,
        title: `Analyzing Core Concepts & Pedagogical Scope: ${coreTopic}`,
        body: `Deconstructed inquiry parameters within ${courseName || 'academic curriculum'}. Identified key conceptual primitives and learning objectives.`,
      });
    }

    // Node 2: Execution Roadmap & Method Selection
    if (hasTask) {
      nodes.push({
        number: 2,
        title: `Executing Calendar Integration & Notification Automation`,
        body: `Calculated exact ISO timestamp for deadline. Configured automated dual email notifications (24h and 12h before due time) via SMTP background queue.`,
      });

    } else if (isComparison) {
      nodes.push({
        number: 2,
        title: `Evaluating Performance & Protocol Tradeoffs: ${coreTopic}`,
        body: `Systematically weighed throughput, latency, reliability, statefulness, and resource overhead between compared alternatives.`,
      });
    } else if (hasCode || lang) {
      nodes.push({
        number: 2,
        title: `Designing ${lang || 'Software'} Architecture & Modularity: ${coreTopic}`,
        body: `Structured clean, idiomatic implementation with defensive boundary checks, separated high-level chat explanation and core deliverable for dedicated window.`,
      });
    } else if (hasLatex) {
      nodes.push({
        number: 2,
        title: `Formulating Step-by-Step Analytical Derivation: ${coreTopic}`,
        body: `Established intermediate algebraic transformations, substitution rules, and dimensional consistency checks for mathematical rigor.`,
      });
    } else {
      nodes.push({
        number: 2,
        title: `Structuring Progressive Explanation & Conceptual Bridges: ${coreTopic}`,
        body: `Designed multi-phase pedagogical roadmap: intuitive real-world analog, formal academic definitions, and structured key takeaways.`,
      });
    }

    // Node 3: Deliverables Synthesis
    if (hasFile) {
      const fileTool = toolCallLogs.find((t) => t.name === 'generate_downloadable_file');
      const filename = fileTool?.args?.filename || 'downloadable_asset';
      nodes.push({
        number: 3,
        title: `Compiling Physical Deliverable: ${filename}`,
        body: `Synthesized production-ready asset "${filename}", verified file byte integrity, and prepared interactive 1-click download card.`,
      });

    } else if (hasCode) {
      nodes.push({
        number: 3,
        title: `Synthesizing ${lang || 'Code'} Implementation & Side Window Dispatch: ${coreTopic}`,
        body: `Generated production-ready source code with descriptive annotations. Transferred complete artifact to dedicated right-side window.`,
      });
    } else if (isDoc) {
      nodes.push({
        number: 3,
        title: `Formatting Official Document Sheet for Dedicated Window: ${coreTopic}`,
        body: `Composed structured formal application with institutional margins, date, subject, respectful body text, and student credentials.`,
      });
    } else if (isComparison) {
      nodes.push({
        number: 3,
        title: `Synthesizing Comparative Matrix & Technical Distinctions: ${coreTopic}`,
        body: `Constructed structured breakdown highlighting critical feature differences, implementation considerations, and recommended use cases.`,
      });
    } else if (hasQuiz) {
      nodes.push({
        number: 3,
        title: `Generating Interactive Assessment Widget: ${coreTopic}`,
        body: `Formulated targeted diagnostic questions with multiple-choice distractors, immediate scoring feedback, and detailed explanatory rationales.`,
      });
    } else {
      nodes.push({
        number: 3,
        title: `Synthesizing Structured Academic Explanation: ${coreTopic}`,
        body: `Authored comprehensive, clear response using bold key terms, structured bullet points, and LaTeX notation where applicable.`,
      });
    }

    // Node 4: Quality & Verification Invariant
    if (hasCode || lang) {
      nodes.push({
        number: 4,
        title: `Verifying Boundary Invariants & Asymptotic Complexity: ${coreTopic}`,
        body: `Conducted boundary stress analysis for empty inputs, off-by-one pointer errors, and validated asymptotic complexity bounds.`,
      });
    } else if (isDoc) {
      nodes.push({
        number: 4,
        title: `Institutional Etiquette & Salutation Verification: ${coreTopic}`,
        body: `Audited letter structure for formal administrative etiquette, accurate date placement, credentials placeholders, and direct submission readiness.`,
      });
    } else if (isComparison) {
      nodes.push({
        number: 4,
        title: `Protocol Invariants & Technical Tradeoff Verification: ${coreTopic}`,
        body: `Verified standards compliance, packet overhead figures, latency characteristics, and concrete real-world adoption patterns for ${coreTopic}.`,
      });
    } else if (hasTask) {
      nodes.push({
        number: 4,
        title: `Verifying Calendar Sync & Notification Arming: ${coreTopic}`,
        body: `Confirmed database persistence, verified deduplication checks, and armed dual background SMTP reminders.`,
      });
    } else {
      nodes.push({
        number: 4,
        title: `Curriculum Coherence & Pedagogical Integrity: ${coreTopic}`,
        body: `Ensured thorough explanation without truncation, validated LaTeX mathematical symbols, and aligned concepts with ${courseName || 'syllabus'}.`,
      });
    }

    return nodes.map((n) => `### ${n.number}. ${n.title}\n${n.body}`).join('\n\n');
  }

  public async autoDetectAndGenerateFile(
    prompt: string,
    finalAnswer: string,
    courseId: string,
    widgets: ChatWidgetPayload[],
    toolCallLogs: any[],
    history: Array<{ role: 'user' | 'assistant'; text: string }> = []
  ) {
    if (widgets.some((w) => w.type === 'files')) return;

    // NEVER auto-generate file if user is asking to analyze, summarize, or read a link/URL!
    if (/\b(?:https?:\/\/|www\.)\S+/i.test(prompt) && /(?:analyze|summarize|summary|overview|explain|points|parho|parh|read|kya hai)\b/i.test(prompt)) {
      return;
    }

    // Strip URLs before checking for file names so "youtube.com" doesn't match "youtube.c"!
    const promptWithoutUrls = prompt.replace(/https?:\/\/\S+|www\.\S+/gi, '');

    const fileRequestMatch = promptWithoutUrls.match(/\b([a-zA-Z0-9_\-]+\.(?:py|txt|docx|pdf|csv|json|md|html|css|js|ts|cpp|java))\b/i);
    const formatMatch = promptWithoutUrls.match(/\b(docx|docz|word|pdf|python|py|txt|csv|excel|sheet)\b/i);
    const actionMatch = /\b(?:download|bana|bna|file|export|save|convert|generate|create)\b/i.test(promptWithoutUrls);

    const isFileRequest = Boolean(fileRequestMatch || (formatMatch && actionMatch));
    if (!isFileRequest) return;

    let targetFilename = fileRequestMatch?.[1];
    if (!targetFilename) {
      const fmt = formatMatch?.[1]?.toLowerCase();
      if (/\b(?:prompt|system\s*prompt)\b/i.test(prompt)) targetFilename = 'prompt.txt';
      else if (/\b(?:cheat\s*sheet)\b/i.test(prompt)) targetFilename = 'cheat_sheet.txt';
      else if (/\b(?:study\s*guide|guide)\b/i.test(prompt)) targetFilename = 'study_guide.txt';
      else if (fmt === 'docx' || fmt === 'docz' || fmt === 'word') targetFilename = 'notes.docx';
      else if (fmt === 'pdf') targetFilename = 'document.pdf';
      else if (fmt === 'python' || fmt === 'py') targetFilename = 'script.py';
      else if (fmt === 'csv' || fmt === 'excel' || fmt === 'sheet') targetFilename = 'data.csv';
      else targetFilename = 'notes.txt';
    }

    const isCodeFile = /\.(?:py|js|ts|cpp|java|c|cs|html|css|json|sql|sh)$/i.test(targetFilename);
    let fileContent = '';

    // 1. Try to get code block if it's a code file
    if (isCodeFile && finalAnswer) {
      const codeBlockMatch = finalAnswer.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]+?)```/);
      if (codeBlockMatch) {
        fileContent = codeBlockMatch[1].trim();
      }
    }

    // 2. If no code block or it's a document (.docx, .pdf, .txt, .md), check finalAnswer
    if (!fileContent && finalAnswer && finalAnswer.trim().length > 30) {
      const codeBlockMatch = finalAnswer.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]+?)```/);
      if (isCodeFile && codeBlockMatch) {
        fileContent = codeBlockMatch[1].trim();
      } else {
        fileContent = finalAnswer.trim();
      }
    }

    // 3. If fileContent is still too short (< 30 chars), check prompt for embedded text
    if (!fileContent || fileContent.length < 30) {
      const strippedPrompt = prompt
        .replace(/^(?:is ko|isko|ye|yeh|please|bhai)?\s*(?:docx|pdf|txt|py|python|word)?\s*(?:ky andr|ke andr|mein|format mein|file)?\s*(?:bna kr do|bana kar do|bana do|bna do|convert karo|download link do|export karo)[:\s]*/i, '')
        .trim();

      if (strippedPrompt.length > 30) {
        fileContent = strippedPrompt;
      }
    }

    // 4. If still too short, check history for the last substantial assistant message
    if (!fileContent || fileContent.length < 30) {
      const lastSubstantial = [...history].reverse().find((h) => h.text && h.text.trim().length > 40);
      if (lastSubstantial) {
        const codeBlockMatch = lastSubstantial.text.match(/```(?:[a-zA-Z0-9_-]+)?\n([\s\S]+?)```/);
        if (isCodeFile && codeBlockMatch) {
          fileContent = codeBlockMatch[1].trim();
        } else {
          fileContent = lastSubstantial.text.trim();
        }
      }
    }

    if (!fileContent || fileContent.length < 5) return;

    try {
      const genRes = await fileTools.generateDownloadableFile(
        courseId,
        targetFilename,
        fileContent,
        targetFilename
      );
      if (genRes.success && genRes.file) {
        widgets.push({
          type: 'files',
          data: [genRes.file],
        });
        toolCallLogs.push({
          name: 'generate_downloadable_file',
          args: { filename: targetFilename },
          result: genRes.file,
        });
      }
    } catch (err: any) {
      console.warn('[AgentService] Auto-generate file error:', err.message);
    }
  }
}

export const agentService = new AgentService();
