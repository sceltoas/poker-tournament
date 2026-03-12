import { MergeSuggestion } from '../types';
import { ArrowRight, Check, X } from 'lucide-react';

interface Props {
  suggestion: MergeSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
}

export default function MergeBanner({ suggestion, onAccept, onDismiss }: Props) {
  return (
    <div className="merge-banner">
      <div className="merge-content">
        <span className="merge-icon">🔀</span>
        <p>
          <strong>Merge suggested:</strong> Table {suggestion.fromTable.tableNumber}{' '}
          ({suggestion.fromTable.playerCount} players)
          <ArrowRight size={16} className="merge-arrow" />
          Table {suggestion.toTable.tableNumber}
        </p>
      </div>
      <div className="merge-actions">
        <button onClick={onAccept} className="btn-merge-accept">
          <Check size={16} /> Accept
        </button>
        <button onClick={onDismiss} className="btn-merge-dismiss">
          <X size={16} /> Dismiss
        </button>
      </div>
    </div>
  );
}
