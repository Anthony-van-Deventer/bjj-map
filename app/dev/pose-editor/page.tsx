import type { Metadata } from "next";
import { Suspense } from "react";
import { PoseEditor } from "@/components/PoseEditor";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Pose editor · BJJ Map" };

async function Editor({ searchParams }: { searchParams: PageProps<"/dev/pose-editor">["searchParams"] }) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return (
    <PoseEditor content={getContent()} initialTechnique={first(params.technique)} initialPose={first(params.pose)} />
  );
}

export default function PoseEditorPage({ searchParams }: PageProps<"/dev/pose-editor">) {
  return (
    <Suspense>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}
