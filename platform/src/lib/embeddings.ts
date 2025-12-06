import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embedMany } from "ai";
import { Effect, Schedule } from "effect";
import { isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { linksTable } from "../db/schema";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const BATCH_SIZE = 200;

export const QWEN_EMB_MODEL = openrouter.textEmbeddingModel(
  "qwen/qwen3-embedding-8b",
  {
    extraBody: {
      dimensions: 1024,
    },
  },
);

function createDocument(link: {
  title: string;
  snippet: string;
  fulltext: string | null;
}): string {
  const parts = [
    `<title>${link.title}</title>`,
    `<snippet>${link.snippet}</snippet>`,
  ];
  if (link.fulltext) {
    const truncated = link.fulltext.slice(0, 1000);
    parts.push(`<content>${truncated}</content>`);
  }
  return parts.join("\n");
}

export const embedDb = () =>
  Effect.gen(function* () {
    const allLinks = yield* Effect.tryPromise(() =>
      db
        .select({
          id: linksTable.id,
          title: linksTable.title,
          snippet: linksTable.snippet,
          fulltext: linksTable.fulltext,
        })
        .from(linksTable)
        .where(isNull(linksTable.embedding_qwen8b)),
    );

    console.log(`Found ${allLinks.length} links to embed`);

    if (allLinks.length === 0) {
      return { embedded: 0, tokens: 0 };
    }

    const totalBatches = Math.ceil(allLinks.length / BATCH_SIZE);
    console.log(
      `Processing in ${totalBatches} batch${totalBatches > 1 ? "es" : ""}`,
    );

    const processBatch = (batchIndex: number) =>
      Effect.gen(function* () {
        const start = batchIndex * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, allLinks.length);
        const batchLinks = allLinks.slice(start, end);

        const documents = batchLinks.map(createDocument);

        console.log(
          `Batch ${batchIndex + 1} - embedding ${start} to ${end} links`,
        );
        const { embeddings, usage } = yield* Effect.tryPromise(() =>
          embedMany({
            model: QWEN_EMB_MODEL,
            values: documents,
          }),
        ).pipe(
          Effect.retry({
            schedule: Schedule.exponential(1000),
            times: 3,
          }),
        );

        console.log(
          `Batch ${batchIndex + 1} - embedded links, inserting into db`,
        );

        const values = batchLinks.map(
          (link, i) =>
            sql`(${link.id}::int, ${JSON.stringify(embeddings[i])}::vector)`,
        );

        yield* Effect.tryPromise(() =>
          db.execute(sql`
            UPDATE ${linksTable}
            SET embedding_qwen8b = data.embedding
            FROM (VALUES ${sql.join(values, sql`, `)}) AS data(id, embedding)
            WHERE ${linksTable.id} = data.id
          `),
        );

        console.log(
          `Batch ${batchIndex + 1}/${totalBatches} complete (${end}/${allLinks.length} links)`,
        );

        return usage.tokens;
      }).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            console.error(`Error processing batch ${batchIndex + 1}:`, error);
            return 0;
          }),
        ),
      );

    const batchEffects = Array.from({ length: totalBatches }, (_, i) =>
      processBatch(i),
    );

    const tokenCounts = yield* Effect.all(batchEffects, { concurrency: 10 });
    const totalTokens = tokenCounts.reduce((sum, tokens) => sum + tokens, 0);

    return { embedded: allLinks.length, tokens: totalTokens };
  });
