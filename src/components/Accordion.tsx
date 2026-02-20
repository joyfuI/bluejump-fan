import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

export type AccordionProps = {
  children: ReactNode;
  label: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

const Accordion = ({
  children,
  label,
  defaultOpen = false,
  className = '',
}: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <span className={`inline ${className}`}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="inline-flex items-baseline gap-1 align-baseline text-left leading-[inherit]"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <ChevronRight
          aria-hidden
          className={`h-[1em] w-[1em] shrink-0 translate-y-[0.06em] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
        <span className="leading-[inherit]">{label}</span>
      </button>
      <div
        className={`block overflow-hidden align-top transition-[max-height] duration-200 ${open ? 'max-h-screen' : 'max-h-0'}`}
        id={contentId}
      >
        <span className="block">{children}</span>
      </div>
    </span>
  );
};

export default Accordion;
