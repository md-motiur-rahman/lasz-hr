"use client";

import { useState } from "react";
import EmployeeFormModal, { type EmployeeRecord } from "@/components/EmployeeFormModal";

export default function EmployeeEditButton({ initial }: { initial: EmployeeRecord }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center h-10 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
      >
        Edit
      </button>
      <EmployeeFormModal
        open={open}
        mode="edit"
        initial={initial}
        onClose={() => setOpen(false)}
        onSaved={() => window.location.reload()}
      />
    </>
  );
}
