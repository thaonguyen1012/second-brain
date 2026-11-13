'use client';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Space UI Select over a short list of `{ value, label }` choices (filters and form fields). */
export function ChoiceSelect<V extends string>({
  value,
  onChange,
  choices,
  label,
  id,
  className,
  ...aria
}: {
  value: V;
  onChange: (value: V) => void;
  choices: readonly { value: V; label: string }[];
  label: string;
  id?: string;
  className?: string;
  /** A form field's state, on the trigger (useInvalidFields().field(), DESIGN.md §6 "Form errors"). */
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
}) {
  return (
    <Select items={choices} value={value} onValueChange={(v) => v !== null && onChange(v as V)}>
      <SelectTrigger id={id} aria-label={label} className={className} {...aria}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {choices.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
