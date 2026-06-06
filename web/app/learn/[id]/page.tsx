import { SEED_POINTS } from "@/lib/telos/engine";
import { Lesson } from "./lesson";

export function generateStaticParams() {
  return SEED_POINTS.map((p) => ({ id: p.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Lesson id={id} />;
}
