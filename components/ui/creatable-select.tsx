'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Plus,Search} from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
  meta?: string;
};

type CreatableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyOptionLabel?: string;
  onCreate?: (name: string) => Promise<string | void>;
  createLabel?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

export function CreatableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyOptionLabel,
  onCreate,
  createLabel = 'item',
  disabled = false,
  ariaLabel,
}: CreatableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find(o => o.value === value),
    [options, value]
  );

  const displayLabel = selectedOption
    ? selectedOption.label
    : value === '' && emptyOptionLabel
      ? emptyOptionLabel
      : value || placeholder;

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    const list: SelectOption[] = [];
    if (emptyOptionLabel && (!q || emptyOptionLabel.toLowerCase().includes(q))) {
      list.push({ value: '', label: emptyOptionLabel });
    }
    for (const opt of options) {
      if (opt.value === '' && emptyOptionLabel) continue;
      if (!q || opt.label.toLowerCase().includes(q) || (opt.meta && opt.meta.toLowerCase().includes(q))) {
        list.push(opt);
      }
    }
    return list;
  }, [options, emptyOptionLabel, trimmed]);

  const exactMatch = useMemo(() => {
    if (!trimmed) return true;
    const lower = trimmed.toLowerCase();
    if (emptyOptionLabel && emptyOptionLabel.toLowerCase() === lower) return true;
    return options.some(o => o.label.toLowerCase() === lower);
  }, [options, emptyOptionLabel, trimmed]);

  const canCreateNow = Boolean(onCreate && trimmed && !exactMatch);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    setCreateErr('');
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
    setCreateErr('');
  }, [query]);

  async function handleCreate() {
    if (!onCreate || !trimmed || creating) return;
    setCreating(true);
    setCreateErr('');
    try {
      const created = await onCreate(trimmed);
      if (typeof created === 'string') {
        onChange(created);
      }
      setQuery('');
      setOpen(false);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : `Could not create ${createLabel}.`);
    } finally {
      setCreating(false);
    }
  }

  function handleSelect(val: string) {
    onChange(val);
    setQuery('');
    setOpen(false);
  }

  const totalItems = filtered.length + (canCreateNow ? 1 : 0);

  return (
    <div className="creatable-select" ref={rootRef}>
      <button
        type="button"
        className={`creatable-trigger${!selectedOption && !emptyOptionLabel && !value ? ' is-placeholder' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="creatable-trigger-label">{displayLabel}</span>
        <ChevronDown className="creatable-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="creatable-popover" role="listbox">
          <div className="creatable-search-row">
            <Search className="creatable-search-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              className="creatable-search-input"
              placeholder={onCreate ? `Search or add ${createLabel}…` : `Search ${createLabel}…`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  setQuery('');
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (totalItems > 0) setActiveIndex(i => (i + 1) % totalItems);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (totalItems > 0) setActiveIndex(i => (i - 1 + totalItems) % totalItems);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (activeIndex < filtered.length) {
                    handleSelect(filtered[activeIndex].value);
                  } else if (canCreateNow) {
                    void handleCreate();
                  }
                }
              }}
            />
          </div>

          <div className="creatable-list">
            {filtered.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isActive = idx === activeIndex;
              return (
                <button
                  key={`${opt.value}::${opt.label}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`creatable-option${isSelected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                >
                  <span className="creatable-option-text">
                    <span>{opt.label}</span>
                    {opt.meta && <small className="creatable-option-meta">{opt.meta}</small>}
                  </span>
                  {isSelected && <Check className="creatable-check" aria-hidden="true" />}
                </button>
              );
            })}

            {!filtered.length && !canCreateNow && (
              <div className="creatable-empty">No matches found</div>
            )}

            {canCreateNow && (
              <button
                type="button"
                className={`creatable-add-btn${activeIndex === filtered.length ? ' is-active' : ''}`}
                disabled={creating}
                onMouseEnter={() => setActiveIndex(filtered.length)}
                onClick={() => void handleCreate()}
              >
                <Plus className="creatable-plus" aria-hidden="true" />
                <span>{creating ? `Adding ${createLabel}…` : `Add "${trimmed}"`}</span>
              </button>
            )}

            {onCreate && !trimmed && (
              <div className="creatable-hint">Type a name to add a new {createLabel}</div>
            )}
          </div>

          {createErr && <div className="creatable-error">{createErr}</div>}
        </div>
      )}
    </div>
  );
}
