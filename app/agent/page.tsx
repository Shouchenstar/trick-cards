import { Suspense } from "react";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";

export default function AgentPage() {
  return (
    <Suspense>
      <AgentWorkspace />
    </Suspense>
  );
}
