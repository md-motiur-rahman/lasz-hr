"use client";

import dynamic from "next/dynamic";

const EmployeeYearActivity = dynamic(() => import("@/components/EmployeeYearActivity"), { ssr: false });

export default function EmployeeYearActivitySection({ employeeId, companyId }: { employeeId: string; companyId: string }) {
  return (
    <div className="p-6">
      <EmployeeYearActivity employeeId={employeeId} companyId={companyId} />
    </div>
  );
}
