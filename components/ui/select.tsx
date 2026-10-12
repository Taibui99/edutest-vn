"use client";

import { Dropdown, type DropdownOption } from "./dropdown";
import { cn } from "@/lib/cn";

/* Select form — bản tự vẽ (trước là `<select>` native, popup OS xấu).
 * API giữ nguyên kiểu dùng cũ (label/error/options/placeholder) nhưng
 * `onChange` nhận thẳng value thay vì event. Uncontrolled (`defaultValue` +
 * `name`) cho form server-action như đăng ký. Prop `required` chỉ giữ để khỏi
 * vỡ chỗ dùng cũ (mọi chỗ đều có default nên không cần validate native). */

interface SelectProps {
  label?: string;
  error?: string;
  options: DropdownOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Select({
  label,
  error,
  options,
  placeholder,
  value,
  defaultValue,
  onChange,
  name,
  id,
  disabled,
  ariaLabel,
  className,
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  const labelId = selectId ? `${selectId}-label` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          id={labelId}
          htmlFor={selectId}
          className="text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}
      <Dropdown
        id={selectId}
        labelledBy={labelId}
        ariaLabel={ariaLabel}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        className={cn(error && "[&>button]:border-[var(--danger)]", className)}
      />
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
