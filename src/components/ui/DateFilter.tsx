import { Calendar, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { DatePreset, DateRange, DATE_PRESETS, getPresetRange } from '@/lib/types';

interface DateFilterProps {
  preset: DatePreset;
  range: DateRange | null;
  onPresetChange: (preset: DatePreset) => void;
  onCustomRangeChange: (range: DateRange) => void;
}

export default function DateFilter({ preset, range, onPresetChange, onCustomRangeChange }: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentLabel = DATE_PRESETS.find((p) => p.value === preset)?.label || 'All Time';
  const showCustomInputs = preset === 'custom';

  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={ref}>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-gray-700 text-sm font-medium hover:bg-slate-50 transition"
        >
          <Calendar size={16} className="text-gray-400" />
          <span>{currentLabel}</span>
          <ChevronDown size={14} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 z-30 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 min-w-[180px]">
            <button
              onClick={() => { onPresetChange('all'); setOpen(false); }}
              className="w-full text-left px-3.5 py-2 text-sm text-gray-600 hover:bg-slate-50 transition"
            >
              All Time
            </button>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => { onPresetChange(p.value); setOpen(false); }}
                className={`w-full text-left px-3.5 py-2 text-sm transition ${
                  preset === p.value ? 'bg-[#D4AF37]/10 text-[#a67c00] font-medium' : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {showCustomInputs && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={range ? fmtDate(range.start) : ''}
            onChange={(e) => {
              const start = new Date(e.target.value);
              start.setHours(0, 0, 0, 0);
              onCustomRangeChange({ start, end: range?.end || new Date() });
            }}
            className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-gray-700 text-sm focus:border-[#D4AF37] outline-none transition"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={range ? fmtDate(range.end) : ''}
            onChange={(e) => {
              const end = new Date(e.target.value);
              end.setHours(23, 59, 59, 999);
              onCustomRangeChange({ start: range?.start || new Date(0), end });
            }}
            className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-gray-700 text-sm focus:border-[#D4AF37] outline-none transition"
          />
        </div>
      )}
    </div>
  );
}

export { getPresetRange };
