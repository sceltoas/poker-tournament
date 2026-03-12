interface Props {
  playerName: string;
}

export default function BeerToastOverlay({ playerName }: Props) {
  return (
    <div className="beer-toast-overlay">
      <div className="beer-toast-content">
        <div className="beer-emoji">🍺</div>
        <p className="toast-text">{playerName} raised a toast!</p>
        <p className="toast-sub">Cheers!</p>
      </div>
    </div>
  );
}
