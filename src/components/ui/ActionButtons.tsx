import { MessageCircle, Phone } from 'lucide-react';
import { whatsappLink, telLink } from '@/lib/utils';
import { InteractionType } from '@/lib/types';

interface ActionButtonsProps {
  phone: string;
  size?: 'sm' | 'md';
  onInteraction?: (type: InteractionType) => void;
}

export default function ActionButtons({ phone, size = 'md', onInteraction }: ActionButtonsProps) {
  const btnSize = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 16 : 18;

  const handleClick = (e: React.MouseEvent, type: InteractionType, href: string) => {
    e.stopPropagation();
    if (onInteraction) {
      // Open the link, then notify parent to show the log modal
      window.open(href, '_blank', 'noopener,noreferrer');
      onInteraction(type);
    } else {
      // Default behavior: just navigate
      window.location.href = href;
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={whatsappLink(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnSize} flex items-center justify-center rounded-xl bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md transition-all active:scale-95`}
        title="WhatsApp"
        onClick={(e) => handleClick(e, 'whatsapp', whatsappLink(phone))}
      >
        <MessageCircle size={iconSize} />
      </a>
      <a
        href={telLink(phone)}
        className={`${btnSize} flex items-center justify-center rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md transition-all active:scale-95`}
        title="Call"
        onClick={(e) => handleClick(e, 'call', telLink(phone))}
      >
        <Phone size={iconSize} />
      </a>
    </div>
  );
}
