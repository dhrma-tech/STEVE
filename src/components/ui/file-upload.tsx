"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface FileUploadProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: string;
  description?: string;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  surface?: "light" | "dark";
}

export function FileUpload({
  label,
  description,
  maxFiles,
  onFilesSelected,
  surface = "dark",
  className,
  id,
  disabled,
  multiple,
  ...props
}: FileUploadProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = React.useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) {
        return;
      }

      const files = Array.from(fileList).slice(0, maxFiles ?? fileList.length);
      onFilesSelected(files);
    },
    [disabled, maxFiles, onFilesSelected]
  );

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        "grid min-h-36 cursor-pointer place-items-center gap-3 rounded-[14px] border-[0.8px] border-dashed p-5 text-center outline-none transition-colors focus-within:ring-2 focus-within:ring-[var(--focused)]",
        surface === "dark"
          ? "border-[var(--input)] bg-[var(--foreground-3)] text-[var(--foreground-80)]"
          : "border-[var(--color-border-pill)] bg-[var(--color-surface-raised)] text-[var(--foreground)]",
        isDragging && "border-[var(--focused)] bg-[var(--tt-color-text-blue-contrast)]",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <input
        id={inputId}
        type="file"
        multiple={multiple ?? Boolean(maxFiles && maxFiles > 1)}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
        {...props}
      />
      <span className="grid size-10 place-items-center rounded-[8px] bg-current/8">
        <Upload aria-hidden="true" className="size-5" />
      </span>
      <span className="grid gap-1">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="max-w-[42ch] text-xs leading-5 text-current/60">{description}</span> : null}
      </span>
    </label>
  );
}

