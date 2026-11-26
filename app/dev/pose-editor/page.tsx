import type { Metadata } from "next";
import { PoseEditor } from "@/components/PoseEditor";
import { getContent } from "@/lib/content";

export const metadata: Metadata = { title: "Pose editor · BJJ Map" };

export default function PoseEditorPage() {
  return <PoseEditor poses={getContent().poses} />;
}
