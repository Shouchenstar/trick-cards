import { Suspense } from "react";
import { CardsWorkspace } from "@/components/cards/CardsWorkspace";

export default function CardsPage() {
  return (
    <Suspense>
      <CardsWorkspace />
    </Suspense>
  );
}
