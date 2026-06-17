import json
import uuid
from typing import Any

import chromadb
from chromadb.utils import embedding_functions

from app.config import settings

_ef: embedding_functions.EmbeddingFunction | None = None
_clients: dict[str, chromadb.PersistentClient] = {}


def _embedding_fn() -> embedding_functions.EmbeddingFunction:
    global _ef
    if _ef is None:
        _ef = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=settings.embedding_model
        )
    return _ef


def _client() -> chromadb.PersistentClient:
    key = str(settings.chroma_path())
    if key not in _clients:
        _clients[key] = chromadb.PersistentClient(path=key)
    return _clients[key]


def collection_name(user_id: int) -> str:
    return f"user_{user_id}_knowledge"


def _get_collection(user_id: int):
    return _client().get_or_create_collection(
        name=collection_name(user_id),
        embedding_function=_embedding_fn(),
        metadata={"user_id": str(user_id)},
    )


def chunk_text(text: str) -> list[str]:
    size = settings.chunk_size
    overlap = settings.chunk_overlap
    if len(text) <= size:
        return [text] if text.strip() else []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


def add_document(user_id: int, text: str, source: str) -> list[str]:
    col = _get_collection(user_id)
    chunks = chunk_text(text)
    if not chunks:
        return []
    ids = [f"{source}_{uuid.uuid4().hex[:12]}_{i}" for i in range(len(chunks))]
    metadatas = [{"source": source[:200], "chunk_index": i} for i in range(len(chunks))]
    col.add(ids=ids, documents=chunks, metadatas=metadatas)
    return ids


def delete_document_chunks(user_id: int, ids: list[str]) -> None:
    if not ids:
        return
    col = _get_collection(user_id)
    col.delete(ids=ids)


def retrieve(user_id: int, query: str, n_results: int = 5) -> list[dict[str, Any]]:
    col = _get_collection(user_id)
    count = col.count()
    if count == 0:
        return []
    n = min(n_results, max(1, count))
    res = col.query(query_texts=[query], n_results=n)
    out: list[dict[str, Any]] = []
    docs = res.get("documents") or [[]]
    metas = res.get("metadatas") or [[]]
    dists = res.get("distances") or [[]]
    for i, doc in enumerate(docs[0]):
        out.append(
            {
                "text": doc,
                "metadata": metas[0][i] if metas and metas[0] else {},
                "distance": dists[0][i] if dists and dists[0] else None,
            }
        )
    return out


def document_samples(user_id: int, limit: int = 12, max_chars: int = 9000) -> list[dict[str, Any]]:
    col = _get_collection(user_id)
    count = col.count()
    if count == 0:
        return []
    res = col.get(limit=min(limit, count), include=["documents", "metadatas"])
    docs = res.get("documents") or []
    metas = res.get("metadatas") or []
    out: list[dict[str, Any]] = []
    used = 0
    for i, doc in enumerate(docs):
        if not doc:
            continue
        text = str(doc)
        remaining = max_chars - used
        if remaining <= 0:
            break
        clipped = text[:remaining]
        used += len(clipped)
        out.append(
            {
                "text": clipped,
                "metadata": metas[i] if i < len(metas) and metas[i] else {},
            }
        )
    return out


def load_ids_from_db(stored: str) -> list[str]:
    try:
        data = json.loads(stored)
        if isinstance(data, list):
            return [str(x) for x in data]
    except json.JSONDecodeError:
        pass
    return []
