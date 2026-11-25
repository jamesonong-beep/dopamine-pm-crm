import { recordSortOptions, type RecordSort } from '../lib/record-order';

export default function RecordSortSelect<Extra extends string = never>({
  label, value, onChange, extra = []
}: {
  label: string;
  value: RecordSort | Extra;
  onChange: (value: RecordSort | Extra) => void;
  extra?: ReadonlyArray<{ value: Extra; label: string }>;
}) {
  const options = [...recordSortOptions, ...extra];
  return <label className="record-sort">Sort by
    <select aria-label={label} value={value} onChange={event => {
      const option = options.find(item => item.value === event.target.value);
      if (option) onChange(option.value);
    }}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
