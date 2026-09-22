export interface ChatWidgetPayload {
  type:
    | 'quiz'
    | 'chart'
    | 'visualize'
    | 'comparison'
    | 'step_card'
    | 'translation'
    | 'recipe'
    | 'itinerary'
    | 'link_preview'
    | 'message_compose'
    | 'files'
    | 'options_card'
    | 'user_input'
    | 'task_scheduled'
    | 'schedule_overview'
    | 'video';
  data: any;
}

export const widgetTools = {
  createQuizWidget(args: {
    title: string;
    questions: Array<{
      question: string;
      options: string[];
      correctAnswerIndex: number;
      explanation: string;
    }>;
  }): ChatWidgetPayload {
    return {
      type: 'quiz',
      data: args,
    };
  },

  createChartWidget(args: {
    title: string;
    chartType: 'bar' | 'line' | 'pie';
    labels: string[];
    values: number[];
    unit?: string;
    datasetLabel?: string;
  }): ChatWidgetPayload {
    return {
      type: 'chart',
      data: args,
    };
  },

  createVisualizeWidget(args: {
    title: string;
    svgContent?: string;
    diagramType?: string;
    description: string;
  }): ChatWidgetPayload {
    return {
      type: 'visualize',
      data: args,
    };
  },

  createComparisonWidget(args: {
    title: string;
    columns: string[];
    rows: Array<{
      feature: string;
      values: string[];
      highlight?: boolean;
    }>;
    recommendation?: string;
  }): ChatWidgetPayload {
    return {
      type: 'comparison',
      data: args,
    };
  },

  createStepCardWidget(args: {
    title: string;
    description?: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      detail: string;
      tip?: string;
    }>;
  }): ChatWidgetPayload {
    return {
      type: 'step_card',
      data: args,
    };
  },

  createTranslationWidget(args: {
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    pronunciation?: string;
    notes?: string;
  }): ChatWidgetPayload {
    return {
      type: 'translation',
      data: args,
    };
  },

  createRecipeWidget(args: {
    title: string;
    prepTime: string;
    difficulty?: string;
    servings?: string;
    itemsOrIngredients: string[];
    instructions: string[];
  }): ChatWidgetPayload {
    return {
      type: 'recipe',
      data: args,
    };
  },

  createItineraryWidget(args: {
    title: string;
    location: string;
    days: Array<{
      day: number;
      title: string;
      activities: string[];
    }>;
  }): ChatWidgetPayload {
    return {
      type: 'itinerary',
      data: args,
    };
  },

  createLinkPreviewWidget(args: {
    url: string;
    title: string;
    description: string;
    domain?: string;
    thumbnailUrl?: string;
  }): ChatWidgetPayload {
    return {
      type: 'link_preview',
      data: args,
    };
  },

  createMessageComposeWidget(args: {
    recipient?: string;
    subject: string;
    body: string;
    tone?: 'academic' | 'formal' | 'casual';
  }): ChatWidgetPayload {
    return {
      type: 'message_compose',
      data: args,
    };
  },

  createOptionsCardWidget(args: {
    title: string;
    description?: string;
    category?: string;
    options: Array<{
      id: string;
      title: string;
      subtitle?: string;
      pros?: string[];
      cons?: string[];
      badge?: string;
      recommendation?: boolean;
      actionPrompt?: string;
    }>;
    disclaimer?: string;
  }): ChatWidgetPayload {
    return {
      type: 'options_card',
      data: args,
    };
  },

  createUserInputWidget(args: {
    prompt: string;
    questionId?: string;
    options: Array<{
      label: string;
      value: string;
      hint?: string;
    }>;
  }): ChatWidgetPayload {
    return {
      type: 'user_input',
      data: args,
    };
  },

  createTaskScheduledWidget(args: {
    task: {
      id: string;
      title: string;
      type: string;
      subject?: string;
      deadline: string;
      priority: string;
      description?: string;
    };
    reminders: Array<{
      label: string;
      timeFormatted: string;
      channel: string;
    }>;
    calendarUrl?: string;
  }): ChatWidgetPayload {
    return {
      type: 'task_scheduled',
      data: args,
    };
  },

  createScheduleOverviewWidget(args: {
    title: string;
    tasks: Array<{
      id: string;
      title: string;
      type: string;
      subject?: string;
      deadline: string;
      priority: string;
      timeRemaining?: string;
    }>;
    calendarUrl?: string;
  }): ChatWidgetPayload {
    return {
      type: 'schedule_overview',
      data: args,
    };
  },
};
