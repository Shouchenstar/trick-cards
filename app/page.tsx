import { Suspense } from "react";
import { CardsWorkspace } from "@/components/cards/CardsWorkspace";

export default function HomePage() {
  return (
    <Suspense>
      <CardsWorkspace />
    </Suspense>
  );
}
