import { useState } from "react";
const MyComp = () => {
  const [roleUpdating, setRoleUpdating] = useState<{
    id: string;
    role: "OWNER" | "STAFF";
  } | null>(null);
  return <div>test</div>;
};
