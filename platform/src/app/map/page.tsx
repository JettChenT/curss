"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";
import { Info, Home, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PARQUET_URL =
  "https://0klmtif16lft1ilh.public.blob.vercel-storage.com/viz/all_links.parquet";

// Dynamically import the EmbeddingAtlas component to avoid SSR issues
const EmbeddingAtlasView = dynamic<{ parquetUrl: string }>(
  () => import("@/components/embedding-atlas-view"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-zinc-400 font-mono text-sm">
            Loading components...
          </p>
        </div>
      </div>
    ),
  },
);

export default function MapPage() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  return (
    <div className="relative h-screen w-full">
      <EmbeddingAtlasView parquetUrl={PARQUET_URL} />

      {/* Floating Info Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {isInfoOpen ? (
          <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-4 w-72 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-sm">Map of Curius</h3>
              <button
                type="button"
                onClick={() => setIsInfoOpen(false)}
                className="text-muted-foreground hover:text-foreground -mt-1 -mr-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This is a visualization of all links saved on{" "}
              <a
                href="https://curius.app"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Curius
              </a>
              , arranged by semantic similarity using embeddings.
            </p>
            <Button asChild className="w-full" size="sm">
              <Link href="/">
                <Home className="h-4 w-4" />
                Back to Feed
              </Link>
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105"
          >
            <Info className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
