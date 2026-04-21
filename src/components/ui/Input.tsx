import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  children?: ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className = "", ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input
        ref={ref}
        className={`input ${error ? "border-red-400 focus:border-red-600" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className = "", rows = 4, ...rest },
  ref,
) {
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea
        ref={ref}
        rows={rows}
        className={`input ${error ? "border-red-400 focus:border-red-600" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  options: { value: string; label: string }[];
}

export function Select({ label, hint, error, options, className = "", ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <select className={`input ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Checkbox({ label, hint, className = "", ...rest }: CheckboxProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        className={`mt-0.5 h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-2 focus:ring-accent-400 ${className}`}
        {...rest}
      />
      <span>
        <span className="text-sm text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}
