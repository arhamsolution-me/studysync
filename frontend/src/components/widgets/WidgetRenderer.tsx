import QuizWidget from './QuizWidget';
import ChartWidget from './ChartWidget';
import ComparisonWidget from './ComparisonWidget';
import DraftComposerWidget from './DraftComposerWidget';
import FileDeliveryWidget from './FileDeliveryWidget';
import TranslationWidget from './TranslationWidget';
import StepCardWidget from './StepCardWidget';
import RecipeWidget from './RecipeWidget';
import ItineraryWidget from './ItineraryWidget';
import VisualizeWidget from './VisualizeWidget';
import OptionsCardWidget from './OptionsCardWidget';
import UserInputWidget from './UserInputWidget';
import VideoPlayerWidget from './VideoPlayerWidget';

export interface WidgetPayload {
  type: string;
  data: any;
}

export interface WidgetRendererProps {
  widgets?: WidgetPayload[];
}

export default function WidgetRenderer({ widgets }: WidgetRendererProps) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      {widgets.map((widget, idx) => {
        switch (widget.type) {
          case 'quiz':
            return <QuizWidget key={idx} data={widget.data} />;
          case 'chart':
            return <ChartWidget key={idx} data={widget.data} />;
          case 'comparison':
            return <ComparisonWidget key={idx} data={widget.data} />;
          case 'message_compose':
            return <DraftComposerWidget key={idx} data={widget.data} />;
          case 'files':
            return <FileDeliveryWidget key={idx} data={widget.data} />;
          case 'translation':
            return <TranslationWidget key={idx} data={widget.data} />;
          case 'step_card':
            return <StepCardWidget key={idx} data={widget.data} />;
          case 'recipe':
            return <RecipeWidget key={idx} data={widget.data} />;
          case 'itinerary':
            return <ItineraryWidget key={idx} data={widget.data} />;
          case 'visualize':
            return <VisualizeWidget key={idx} data={widget.data} />;
          case 'options_card':
            return <OptionsCardWidget key={idx} data={widget.data} />;
          case 'user_input':
            return <UserInputWidget key={idx} data={widget.data} />;
          case 'video':
            return <VideoPlayerWidget key={idx} data={widget.data} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

