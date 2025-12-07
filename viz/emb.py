import os

import pandas as pd
from io import BytesIO
import umap
from vercel.blob import BlobClient

BLOB_OUTPUT_PATH = "viz/all_links.parquet"


def viz_data():
    data = pd.read_sql(
        "SELECT id,link,title,snippet,embedding_qwen8b FROM links WHERE embedding_qwen8b IS NOT NULL",
        con=os.getenv("DB_URL"),
    )
    print(f"Loaded {len(data)} rows from DB")
    reducer = umap.UMAP()
    raw_embeddings = [eval(emb) for emb in data["embedding_qwen8b"].tolist()]
    mapper = reducer.fit(raw_embeddings)
    print("UMAP DONE!")
    export_df = data[["id", "link", "title", "snippet"]].copy()
    export_df["projection_x"] = mapper.embedding_[:, 0]
    export_df["projection_y"] = mapper.embedding_[:, 1]
    return export_df


def run_viz_and_export():
    df = viz_data()
    client = BlobClient()
    parquet_buffer = BytesIO()
    df.to_parquet(parquet_buffer, index=False)
    parquet_buffer.seek(0)
    _blob = client.put(
        BLOB_OUTPUT_PATH, parquet_buffer, access="public", overwrite=True
    )
    print(f"Exported {len(df)} rows to {BLOB_OUTPUT_PATH}")


if __name__ == "__main__":
    run_viz_and_export()
