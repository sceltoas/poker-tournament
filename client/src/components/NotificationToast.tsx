import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  message: string;
  onClose: () => void;
}

export default function NotificationToast({ message, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <div className="notification-toast">
      <p>{message}</p>
      <button onClick={onClose} className="toast-close">
        <X size={16} />
      </button>
    </div>
  );
}
