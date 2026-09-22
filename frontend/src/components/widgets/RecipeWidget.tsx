import { useState } from 'react';
import { UtensilsCrossed, Clock, Flame, Users, Check, Minus, Plus } from 'lucide-react';

export interface RecipeWidgetProps {
  data: {
    title: string;
    prepTime: string;
    difficulty?: string;
    servings?: string;
    itemsOrIngredients: string[];
    instructions: string[];
  };
}

export default function RecipeWidget({ data }: RecipeWidgetProps) {
  // Parse base servings number
  const initialServings = parseInt(data.servings || '4', 10) || 4;
  const [servings, setServings] = useState<number>(initialServings);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const adjustServings = (delta: number) => {
    setServings((prev) => Math.max(1, Math.min(20, prev + delta)));
  };

  const ingredients = data.itemsOrIngredients || [];
  const instructions = data.instructions || [];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '20px',
        margin: '16px 0',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UtensilsCrossed size={18} color="#EA580C" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>{data.title}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: '#6B7280' }}>
                <Clock size={12} /> {data.prepTime}
              </span>
              {data.difficulty && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.76rem', color: '#EA580C' }}>
                  <Flame size={12} /> {data.difficulty}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Servings Adjuster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 9999, padding: '3px 8px' }}>
          <Users size={13} color="#6B7280" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', minWidth: 60, textAlign: 'center' }}>
            {servings} {servings === 1 ? 'person' : 'servings'}
          </span>
          <button
            type="button"
            onClick={() => adjustServings(-1)}
            disabled={servings <= 1}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: servings > 1 ? 'pointer' : 'not-allowed',
              opacity: servings > 1 ? 1 : 0.4,
              padding: 0,
            }}
          >
            <Minus size={11} />
          </button>
          <button
            type="button"
            onClick={() => adjustServings(1)}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '50%',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Plus size={11} />
          </button>
        </div>
      </div>

      {/* Ingredients List */}
      <div>
        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          Ingredients ({ingredients.length})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6 }}>
          {ingredients.map((item, idx) => {
            const isChecked = !!checkedIngredients[idx];

            return (
              <div
                key={idx}
                onClick={() => toggleIngredient(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: isChecked ? '#F0FDF4' : '#FAFAFA',
                  border: `1px solid ${isChecked ? '#BBF7D0' : '#F3F4F6'}`,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `1.5px solid ${isChecked ? '#16A34A' : '#D1D5DB'}`,
                    background: isChecked ? '#16A34A' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isChecked && <Check size={11} color="#FFFFFF" />}
                </div>
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: isChecked ? '#15803D' : '#374151',
                    textDecoration: isChecked ? 'line-through' : 'none',
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cooking Instructions */}
      <div>
        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          Cooking Instructions ({instructions.length} steps)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {instructions.map((stepText, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: '#FAFAFA',
                border: '1px solid #F3F4F6',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: '#EA580C',
                  color: '#FFFFFF',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {idx + 1}
              </span>
              <span style={{ fontSize: '0.84rem', color: '#374151', lineHeight: 1.5 }}>
                {stepText}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
