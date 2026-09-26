import React from 'react';
import { formStyles } from './formStyles';

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + kontrol + bantuan/error, dengan jarak yang seragam di semua form.
 *
 * Dipakai supaya jarak label→input→pesan selalu sama di semua halaman, apa pun
 * warna aksen yang dipakai halaman tersebut.
 */
export const FormField: React.FC<FormFieldProps> = ({
  label,
  hint,
  error,
  required,
  htmlFor,
  className = '',
  children,
}) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={formStyles.label}>
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {error ? (
      <p className={formStyles.error}>{error}</p>
    ) : hint ? (
      <p className={formStyles.hint}>{hint}</p>
    ) : null}
  </div>
);

type NativeInputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Input teks dengan gaya standar. */
export const TextInput = ({ className = '', ...props }: NativeInputProps) => (
  <input {...props} className={`${formStyles.input} ${className}`} />
);

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Area teks dengan gaya standar. */
export const TextAreaInput = ({ className = '', ...props }: TextAreaProps) => (
  <textarea {...props} className={`${formStyles.textarea} ${className}`} />
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Select dengan gaya standar. */
export const SelectInput = ({ className = '', ...props }: SelectProps) => (
  <select {...props} className={`${formStyles.select} ${className}`} />
);
