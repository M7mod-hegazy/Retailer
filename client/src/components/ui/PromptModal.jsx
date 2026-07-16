import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function PromptModal({ open, title = "أدخل الاسم", defaultValue = "", onConfirm, onCancel, placeholder }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, defaultValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onConfirm?.(trimmed);
  };

  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth="max-w-sm" showDetach={false}>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border-normal bg-bg-input px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          dir="rtl"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onCancel}>إلغاء</Button>
          <Button type="submit" disabled={!value.trim()}>تأكيد</Button>
        </div>
      </form>
    </Modal>
  );
}
