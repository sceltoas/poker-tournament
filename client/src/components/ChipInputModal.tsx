import { useState, useEffect } from 'react';
import { ChipDenomination, DEFAULT_CHIP_DENOMINATIONS } from '../types';

interface Props {
  isOpen: boolean;
  currentChipStack: number | null;
  playerName: string;
  denominations?: ChipDenomination[] | null;
  onSubmit: (chipCount: number) => void;
  onClose: () => void;
}

function formatChipCount(count: number): string {
  if (count >= 10000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}K`;
  return count.toLocaleString();
}

export { formatChipCount };

export default function ChipInputModal({ isOpen, currentChipStack, playerName, denominations, onSubmit, onClose }: Props) {
  const denoms = denominations && denominations.length > 0 ? denominations : DEFAULT_CHIP_DENOMINATIONS;
  const [mode, setMode] = useState<'calculator' | 'direct'>('calculator');
  const [chipCounts, setChipCounts] = useState<number[]>(() => denoms.map(() => 0));
  const [directValue, setDirectValue] = useState(currentChipStack?.toString() || '');

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setChipCounts(denoms.map(() => 0));
      setDirectValue(currentChipStack?.toString() || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculatorTotal = denoms.reduce((sum, d, i) => sum + d.value * chipCounts[i], 0);

  const handleDenomChange = (index: number, delta: number) => {
    setChipCounts((prev) => {
      const next = [...prev];
      next[index] = Math.max(0, next[index] + delta);
      return next;
    });
  };

  const handleSubmit = () => {
    const value = mode === 'calculator' ? calculatorTotal : parseInt(directValue, 10);
    if (!isNaN(value) && value >= 0) {
      onSubmit(value);
    }
  };

  return (
    <>
      <div className="chip-modal-backdrop" onClick={onClose} />
      <div className="chip-input-modal">
        <div className="chip-modal-header">
          <h3>Chips — {playerName}</h3>
          <button className="chip-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="chip-mode-tabs">
          <button
            className={`chip-mode-tab ${mode === 'calculator' ? 'active' : ''}`}
            onClick={() => setMode('calculator')}
          >
            Calculator
          </button>
          <button
            className={`chip-mode-tab ${mode === 'direct' ? 'active' : ''}`}
            onClick={() => setMode('direct')}
          >
            Direct
          </button>
        </div>

        {mode === 'calculator' ? (
          <div className="chip-calculator">
            {denoms.map((d, i) => (
              <div key={d.label} className="chip-denom-row">
                <span className="chip-circle" style={{ background: d.color, border: d.color === '#ffffff' ? '2px solid #888' : '2px solid transparent' }} />
                <span className="chip-denom-label">{d.label}</span>
                <span className="chip-denom-value">({d.value})</span>
                <div className="chip-denom-controls">
                  <button className="chip-btn-minus" onClick={() => handleDenomChange(i, -1)} disabled={chipCounts[i] === 0}>−</button>
                  <span className="chip-denom-count">{chipCounts[i]}</span>
                  <button className="chip-btn-plus" onClick={() => handleDenomChange(i, 1)}>+</button>
                </div>
                <span className="chip-denom-subtotal">{(d.value * chipCounts[i]).toLocaleString()}</span>
              </div>
            ))}
            <div className="chip-total">
              Total: <strong>{formatChipCount(calculatorTotal)}</strong>
            </div>
          </div>
        ) : (
          <div className="chip-direct">
            <input
              type="number"
              className="chip-direct-input"
              value={directValue}
              onChange={(e) => setDirectValue(e.target.value)}
              placeholder="Enter chip count"
              min="0"
              inputMode="numeric"
              autoFocus
            />
            {directValue && !isNaN(parseInt(directValue, 10)) && (
              <div className="chip-direct-preview">
                = {formatChipCount(parseInt(directValue, 10))}
              </div>
            )}
          </div>
        )}

        <button
          className="chip-submit-btn"
          onClick={handleSubmit}
          disabled={mode === 'calculator' ? calculatorTotal === 0 : !directValue || isNaN(parseInt(directValue, 10))}
        >
          Set Chips
        </button>
      </div>
    </>
  );
}
