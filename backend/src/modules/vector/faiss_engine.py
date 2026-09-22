import os
import sys
import json
import pickle
import numpy as np
import faiss

# Backend index directory
INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "faiss_index")
FAISS_FILE = os.path.join(INDEX_DIR, "index.faiss")
PKL_FILE = os.path.join(INDEX_DIR, "index.pkl")

# Root index directory (workspace root for direct visibility)
ROOT_INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(INDEX_DIR)), "faiss_index")
ROOT_FAISS_FILE = os.path.join(ROOT_INDEX_DIR, "index.faiss")
ROOT_PKL_FILE = os.path.join(ROOT_INDEX_DIR, "index.pkl")

DIMENSION = 768

os.makedirs(INDEX_DIR, exist_ok=True)
os.makedirs(ROOT_INDEX_DIR, exist_ok=True)

def load_or_create_index():
    if os.path.exists(FAISS_FILE) and os.path.exists(PKL_FILE):
        try:
            index = faiss.read_index(FAISS_FILE)
            with open(PKL_FILE, "rb") as f:
                docstore = pickle.load(f)
            return index, docstore
        except Exception as e:
            sys.stderr.write(f"[FAISS Engine] Warning loading existing index: {e}. Recreating new.\n")

    # Cosine similarity index: IndexFlatIP (Inner Product) on L2-normalized vectors
    index = faiss.IndexFlatIP(DIMENSION)
    docstore = {
        "docs": {},       # doc_id -> { id, courseId, text, metadata }
        "id_map": []      # position in index -> doc_id
    }
    save_index(index, docstore)
    return index, docstore

def save_index(index, docstore):
    # Save to backend/faiss_index
    faiss.write_index(index, FAISS_FILE)
    with open(PKL_FILE, "wb") as f:
        pickle.dump(docstore, f)

    # Also sync to root faiss_index for convenience
    try:
        if ROOT_INDEX_DIR != INDEX_DIR:
            faiss.write_index(index, ROOT_FAISS_FILE)
            with open(ROOT_PKL_FILE, "wb") as f_root:
                pickle.dump(docstore, f_root)
    except Exception:
        pass

def add_items(items):
    index, docstore = load_or_create_index()
    if not items:
        return {
            "success": True,
            "added": 0,
            "total": index.ntotal,
            "faiss_file": FAISS_FILE,
            "pkl_file": PKL_FILE
        }

    vectors = []
    for item in items:
        doc_id = item["id"]
        cid = item.get("courseId") or item.get("course_id") or ""
        vec = np.array(item["vector"], dtype=np.float32)

        # L2-normalize for exact cosine similarity
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        vectors.append(vec)

        docstore["docs"][doc_id] = {
            "id": doc_id,
            "courseId": cid,
            "course_id": cid,
            "text": item.get("text", ""),
            "vector": item.get("vector", []),
            "metadata": item.get("metadata", {})
        }
        docstore["id_map"].append(doc_id)

    matrix = np.vstack(vectors).astype(np.float32)
    index.add(matrix)
    save_index(index, docstore)

    return {
        "success": True,
        "added": len(items),
        "total": index.ntotal,
        "faiss_file": FAISS_FILE,
        "pkl_file": PKL_FILE,
        "faiss_size_bytes": os.path.getsize(FAISS_FILE),
        "pkl_size_bytes": os.path.getsize(PKL_FILE)
    }

def search(query_vec, course_id=None, top_k=4):
    index, docstore = load_or_create_index()
    if index.ntotal == 0:
        return []

    q = np.array([query_vec], dtype=np.float32)
    norm = np.linalg.norm(q)
    if norm > 0:
        q = q / norm

    # Search top k * 4 to allow course_id filtering
    fetch_k = min(index.ntotal, max(top_k * 4, 15))
    scores, indices = index.search(q, fetch_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(docstore["id_map"]):
            continue
        doc_id = docstore["id_map"][idx]
        doc = docstore["docs"].get(doc_id)
        if not doc:
            continue

        if course_id:
            doc_course = doc.get("courseId") or doc.get("course_id")
            if doc_course != course_id:
                continue

        results.append({
            "id": doc["id"],
            "courseId": doc.get("courseId") or doc.get("course_id"),
            "text": doc["text"],
            "metadata": doc["metadata"],
            "score": float(score)
        })

        if len(results) >= top_k:
            break

    return results

def get_by_course(course_id):
    _, docstore = load_or_create_index()
    results = []
    for doc in docstore["docs"].values():
        doc_course = doc.get("courseId") or doc.get("course_id")
        if not course_id or doc_course == course_id:
            results.append({
                "id": doc["id"],
                "courseId": doc_course,
                "text": doc["text"],
                "metadata": doc.get("metadata", {})
            })
    return results

def delete_course(course_id):
    index, docstore = load_or_create_index()
    if not course_id:
        return {"success": False, "error": "course_id is required"}

    remaining_docs = {}
    remaining_vectors = []
    new_id_map = []

    for doc_id in docstore.get("id_map", []):
        doc = docstore["docs"].get(doc_id)
        if not doc:
            continue
        doc_cid = doc.get("courseId") or doc.get("course_id")
        if doc_cid != course_id:
            remaining_docs[doc_id] = doc
            new_id_map.append(doc_id)
            vec = doc.get("vector")
            if vec:
                v = np.array(vec, dtype=np.float32)
                norm = np.linalg.norm(v)
                if norm > 0:
                    v = v / norm
                remaining_vectors.append(v)

    new_index = faiss.IndexFlatIP(DIMENSION)
    if remaining_vectors:
        matrix = np.vstack(remaining_vectors).astype(np.float32)
        new_index.add(matrix)

    new_docstore = {
        "docs": remaining_docs,
        "id_map": new_id_map
    }
    save_index(new_index, new_docstore)
    return {
        "success": True,
        "deleted_course_id": course_id,
        "remaining_vectors": new_index.ntotal
    }

def clear_index():
    index = faiss.IndexFlatIP(DIMENSION)
    docstore = {"docs": {}, "id_map": []}
    save_index(index, docstore)
    return {"success": True, "total": 0}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "init":
        idx, ds = load_or_create_index()
        print(json.dumps({
            "success": True,
            "total": idx.ntotal,
            "dimension": DIMENSION,
            "faiss_file": FAISS_FILE,
            "pkl_file": PKL_FILE,
            "faiss_size_bytes": os.path.getsize(FAISS_FILE) if os.path.exists(FAISS_FILE) else 0,
            "pkl_size_bytes": os.path.getsize(PKL_FILE) if os.path.exists(PKL_FILE) else 0
        }))

    elif cmd == "add":
        raw = sys.stdin.read()
        payload = json.loads(raw)
        res = add_items(payload)
        print(json.dumps(res))

    elif cmd == "search":
        raw = sys.stdin.read()
        payload = json.loads(raw)
        res = search(
            payload["query_vector"],
            payload.get("courseId") or payload.get("course_id"),
            payload.get("top_k", 4)
        )
        print(json.dumps(res))

    elif cmd == "get_by_course":
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        cid = payload.get("courseId") or payload.get("course_id")
        res = get_by_course(cid)
        print(json.dumps(res))

    elif cmd == "delete_course":
        raw = sys.stdin.read()
        payload = json.loads(raw) if raw.strip() else {}
        cid = payload.get("courseId") or payload.get("course_id")
        res = delete_course(cid)
        print(json.dumps(res))

    elif cmd == "clear":
        res = clear_index()
        print(json.dumps(res))

    elif cmd == "info":
        idx, ds = load_or_create_index()
        print(json.dumps({
            "total_vectors": idx.ntotal,
            "dimension": DIMENSION,
            "faiss_file": FAISS_FILE,
            "pkl_file": PKL_FILE,
            "faiss_size_bytes": os.path.getsize(FAISS_FILE) if os.path.exists(FAISS_FILE) else 0,
            "pkl_size_bytes": os.path.getsize(PKL_FILE) if os.path.exists(PKL_FILE) else 0
        }))
