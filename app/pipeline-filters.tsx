import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { RecordSort } from '../lib/record-order';

export type PipelineSort = RecordSort | 'due' | 'value';
type Field = 'owner' | 'company' | 'supplier' | 'role';
type Filters = Record<Field, string> & { sort: PipelineSort };
type Option = { value: string; label: string };
const fields: [Field, string, string][] = [
  ['owner', 'Owner', 'All owners'], ['company', 'Company', 'All companies'],
  ['supplier', 'Supplier', 'All suppliers'], ['role', 'Work role', 'All roles']
];
const emptyFields = { owner: '', company: '', supplier: '', role: '' };
const activeCount = (filters: Filters) => fields.filter(([key]) => filters[key]).length;

export default function PipelineFilters({ value, options, financials, onChange }: {
  value: Filters; options: Record<Field, Option[]>; financials: boolean; onChange: (filters: Filters) => void;
}) {
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const sync = () => { setMobile(media.matches); setOpen(false); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  function toggle(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }
  const current = mobile ? draft : value;
  const update = mobile ? setDraft : onChange;
  const clear = () => update({ ...current, ...emptyFields });
  const count = activeCount(value);
  const trigger = <button type="button" className="crm-filter-trigger"><SlidersHorizontal size={16} aria-hidden="true"/>Filters
    {count > 0 && <span className="crm-filter-count" aria-label={count + ' active filters'}>{count}</span>}
  </button>;
  const controls = <div className="crm-filter-fields">
    {fields.map(([key, label, all]) => (key !== 'supplier' || options.supplier.length > 0) && <label key={key}>{label}
      <select aria-label={'Pipeline ' + label.toLowerCase()} value={current[key]} onChange={e => update({ ...current, [key]: e.target.value })}>
        <option value="">{all}</option>{options[key].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>)}
    <label className="pipeline-sort">Sort<select aria-label="Sort CRM Pipeline" value={current.sort} onChange={e => update({ ...current, sort: e.target.value as PipelineSort })}>
      <option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option>
      {financials && <option value="value">Value high–low</option>}<option value="due">Next action soonest</option>
      <option value="newest">Newest added</option><option value="oldest">Oldest added</option>
    </select></label>
  </div>;
  if (mobile) return <Sheet open={open} onOpenChange={toggle}>
    <SheetTrigger asChild>{trigger}</SheetTrigger>
    <SheetContent side="bottom" className="crm-filter-sheet" aria-describedby={undefined}>
      <SheetTitle>Filters</SheetTitle>{controls}
      <footer><button type="button" disabled={!activeCount(current)} onClick={clear}>Clear all</button>
        <button type="button" className="primary" onClick={() => { onChange(draft); toggle(false); }}>Apply</button></footer>
    </SheetContent>
  </Sheet>;
  return <Popover open={open} onOpenChange={toggle}><PopoverTrigger asChild>{trigger}</PopoverTrigger>
    <PopoverContent align="start" className="crm-filter-panel" aria-label="Pipeline filters" collisionPadding={12}>
      <header><strong>Filters</strong><button type="button" disabled={!count} className="text-button" onClick={clear}>Clear filters</button></header>
      {controls}
    </PopoverContent>
  </Popover>;
}
