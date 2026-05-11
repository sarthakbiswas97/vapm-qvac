/**
 * QVAC Text-to-Speech -- Local TTS via QVAC SDK (Chatterbox engine).
 *
 * Loads the Chatterbox EN Q4 model set and provides a simple `speak(text)`
 * function that returns a WAV buffer.  All inference runs on-device.
 *
 * The Chatterbox engine requires multiple ONNX sub-models:
 *   - language model, speech encoder, embed tokens, conditional decoder
 *   - tokenizer, latent denoiser, denoiser, reference audio (voice style)
 *
 * Output: 24 kHz mono PCM float32, wrapped in a standard WAV header.
 */

import {
  loadModel,
  textToSpeech,
  unloadModel,
  TTS_LANGUAGE_MODEL_EN_CHATTERBOX_Q4,
  TTS_TOKENIZER_EN_CHATTERBOX,
  TTS_SPEECH_ENCODER_EN_CHATTERBOX_Q4,
  TTS_EMBED_TOKENS_EN_CHATTERBOX_Q4,
  TTS_CONDITIONAL_DECODER_EN_CHATTERBOX_Q4,
  TTS_LATENT_DENOISER_SUPERTONIC_FP32,
  TTS_DENOISER_LAVASR_FP32,
  TTS_VOICE_STYLE_SUPERTONIC,
} from "@qvac/sdk";

const SAMPLE_RATE = 24000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 32; // float32

let ttsModelId = null;

/**
 * Build a WAV file buffer from raw float32 PCM samples.
 * @param {number[]} samples - Array of float32 PCM values (-1..1).
 * @returns {Buffer} Complete WAV file as a Node.js Buffer.
 */
function buildWav(samples) {
  const numSamples = samples.length;
  const dataByteLength = numSamples * 4; // 4 bytes per float32
  const headerSize = 44;
  const totalSize = headerSize + dataByteLength;

  const buffer = Buffer.alloc(totalSize);
  let offset = 0;

  // RIFF header
  buffer.write("RIFF", offset); offset += 4;
  buffer.writeUInt32LE(totalSize - 8, offset); offset += 4;
  buffer.write("WAVE", offset); offset += 4;

  // fmt sub-chunk (PCM float = format code 3)
  buffer.write("fmt ", offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;           // sub-chunk size
  buffer.writeUInt16LE(3, offset); offset += 2;            // audio format: IEEE float
  buffer.writeUInt16LE(NUM_CHANNELS, offset); offset += 2;
  buffer.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * 4, offset); offset += 4; // byte rate
  buffer.writeUInt16LE(NUM_CHANNELS * 4, offset); offset += 2;              // block align
  buffer.writeUInt16LE(BITS_PER_SAMPLE, offset); offset += 2;

  // data sub-chunk
  buffer.write("data", offset); offset += 4;
  buffer.writeUInt32LE(dataByteLength, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    buffer.writeFloatLE(samples[i], offset);
    offset += 4;
  }

  return buffer;
}

/**
 * Load the Chatterbox TTS model set.  Safe to call multiple times.
 * @returns {Promise<string>} The loaded model ID.
 */
export async function initTTS() {
  if (ttsModelId) return ttsModelId;

  console.log("[QVAC TTS] Loading Chatterbox EN Q4 text-to-speech model...");

  ttsModelId = await loadModel({
    modelSrc: TTS_LANGUAGE_MODEL_EN_CHATTERBOX_Q4,
    modelType: "onnx-tts",
    modelConfig: {
      ttsEngine: "chatterbox",
      language: "en",
      ttsTokenizerSrc: TTS_TOKENIZER_EN_CHATTERBOX,
      ttsSpeechEncoderSrc: TTS_SPEECH_ENCODER_EN_CHATTERBOX_Q4,
      ttsEmbedTokensSrc: TTS_EMBED_TOKENS_EN_CHATTERBOX_Q4,
      ttsConditionalDecoderSrc: TTS_CONDITIONAL_DECODER_EN_CHATTERBOX_Q4,
      ttsLanguageModelSrc: TTS_LANGUAGE_MODEL_EN_CHATTERBOX_Q4,
      ttsLatentDenoiserSrc: TTS_LATENT_DENOISER_SUPERTONIC_FP32,
      ttsDenoiserSrc: TTS_DENOISER_LAVASR_FP32,
      referenceAudioSrc: TTS_VOICE_STYLE_SUPERTONIC,
    },
    onProgress: (progress) => {
      if (progress.percent != null && progress.percent % 25 === 0) {
        console.log(`[QVAC TTS] Loading: ${progress.percent}%`);
      }
    },
  });

  console.log("[QVAC TTS] TTS model loaded.");
  return ttsModelId;
}

/**
 * Convert text to speech and return a WAV buffer.
 * Lazily initializes the model on first call.
 *
 * @param {string} text - Text to synthesize.
 * @returns {Promise<Buffer>} WAV audio buffer (24 kHz mono float32).
 */
export async function speak(text) {
  if (!ttsModelId) {
    await initTTS();
  }

  const result = textToSpeech({ modelId: ttsModelId, text });
  const samples = await result.buffer;
  await result.done;

  return buildWav(samples);
}

/**
 * Unload the TTS model and free resources.
 */
export async function shutdownTTS() {
  if (ttsModelId) {
    await unloadModel({ modelId: ttsModelId });
    ttsModelId = null;
    console.log("[QVAC TTS] Model unloaded.");
  }
}
