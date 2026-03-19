import { MergeSuggestion } from '../types';
import { Check, X } from 'lucide-react';

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
          <strong>Merge suggested:</strong> Remove Table {suggestion.removeTable.tableNumber}{' '}
          ({suggestion.removeTable.playerCount} players) and redistribute to {suggestion.remainingTables} remaining table{suggestion.remainingTables > 1 ? 's' : ''}
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
