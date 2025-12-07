"use client";

import { EmbeddingAtlas } from "embedding-atlas/react";
import { useEffect, useState } from "react";
import { Coordinator, wasmConnector } from "@uwdata/vgplot";

interface EmbeddingAtlasViewProps {
  parquetUrl: string;
}

export default function EmbeddingAtlasView({
  parquetUrl,
}: EmbeddingAtlasViewProps) {
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function initializeDatabase() {
      try {
        // Create a new Mosaic coordinator with DuckDB WASM backend
        const coord = new Coordinator();
        const connector = wasmConnector();
        coord.databaseConnector(connector);

        // Load the parquet file into a table named 'links'
        await coord.exec(`
          CREATE TABLE IF NOT EXISTS links AS 
          SELECT * FROM '${parquetUrl}'
        `);

        if (mounted) {
          setCoordinator(coord);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to initialize database:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load data");
          setLoading(false);
        }
      }
    }

    initializeDatabase();

    return () => {
      mounted = false;
    };
  }, [parquetUrl]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          <p className="text-zinc-400 font-mono text-sm">
            Loading embedding data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="text-red-500 text-4xl">⚠</div>
          <p className="text-zinc-200 font-mono">
            Failed to load visualization
          </p>
          <p className="text-zinc-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!coordinator) {
    return null;
  }

  return (
    <div className="h-screen w-full">
      <EmbeddingAtlas
        coordinator={coordinator}
        data={{
          table: "links",
          id: "id",
          projection: { x: "projection_x", y: "projection_y" },
          text: "title",
        }}
        initialState={{
          layoutStates: {
            list: {
              showTable: false,
              showCharts: false,
            },
          },
          timestamp: Date.now(),
          version: "1.0.0",
        }}
      />
    </div>
  );
}
