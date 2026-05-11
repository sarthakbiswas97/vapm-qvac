/**
 * QVAC RAG (Retrieval-Augmented Generation) Module
 *
 * Uses QVAC SDK's built-in RAG functions to ingest trading knowledge
 * and retrieve relevant context for LLM prompts.
 *
 * Knowledge base includes:
 * - Trading rules and risk management guidelines
 * - SOL/USDC market context
 * - SHAP feature interpretation guide
 *
 * Everything runs LOCALLY -- embeddings, chunking, search.
 */

import {
  loadModel,
  embed,
  ragIngest,
  ragSearch,
  ragChunk,
  ragCloseWorkspace,
  EMBEDDINGGEMMA_300M_Q4_0,
} from "@qvac/sdk";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let embedModelId = null;
const WORKSPACE = "trading-knowledge";
const KNOWLEDGE_DIR = join(import.meta.dirname, "..", "data", "knowledge");

/**
 * Initialize the RAG system: load embedding model and ingest knowledge files.
 * @returns {string} The embedding model ID
 */
export async function initRAG() {
  if (embedModelId) return embedModelId;

  console.log("[QVAC RAG] Loading embedding model (EmbeddingGemma 300M)...");
  embedModelId = await loadModel({
    modelSrc: EMBEDDINGGEMMA_300M_Q4_0,
    modelType: "llamacpp-embedding",
    onProgress: (p) => {
      if (p.percent && p.percent % 25 === 0) {
        console.log(`[QVAC RAG] Loading: ${p.percent}%`);
      }
    },
  });
  console.log("[QVAC RAG] Embedding model loaded.");

  await ingestKnowledge();
  return embedModelId;
}

/**
 * Ingest all .txt files from the knowledge directory into the RAG workspace.
 */
async function ingestKnowledge() {
  const files = readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".txt"));
  console.log(`[QVAC RAG] Ingesting ${files.length} knowledge files...`);

  for (const file of files) {
    const content = readFileSync(join(KNOWLEDGE_DIR, file), "utf-8");
    const chunks = await ragChunk({ text: content, chunkSize: 512, overlap: 64 });
    await ragIngest({
      modelId: embedModelId,
      workspace: WORKSPACE,
      chunks: chunks.chunks || [content],
      metadata: { source: file },
    });
    console.log(`[QVAC RAG] Ingested: ${file}`);
  }
}

/**
 * Search the knowledge base for context relevant to a query.
 *
 * @param {string} query - The search query
 * @param {number} topK - Number of results to return (default 3)
 * @returns {string} Concatenated relevant text passages
 */
export async function searchContext(query, topK = 3) {
  if (!embedModelId) await initRAG();

  const results = await ragSearch({
    modelId: embedModelId,
    workspace: WORKSPACE,
    query,
    topK,
  });

  return (results.results || []).map((r) => r.text || r.content || "").join("\n\n");
}

/**
 * Check whether the RAG system is initialized.
 * @returns {boolean}
 */
export function isRAGReady() {
  return embedModelId !== null;
}

/**
 * Get the number of knowledge files in the knowledge directory.
 * @returns {number}
 */
export function getKnowledgeFileCount() {
  try {
    return readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".txt")).length;
  } catch {
    return 0;
  }
}

/**
 * Shut down the RAG workspace and release resources.
 */
export async function shutdownRAG() {
  if (embedModelId) {
    await ragCloseWorkspace({ workspace: WORKSPACE });
    embedModelId = null;
    console.log("[QVAC RAG] Workspace closed.");
  }
}
