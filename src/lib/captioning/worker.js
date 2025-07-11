import { pipeline } from "@huggingface/transformers";

const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: {
      encoder_model: "fp32",
      decoder_model_merged: "q4",
    },
    device: "webgpu",
  },
  wasm: {
    dtype: "q8",
    device: "wasm",
  },
};

/**
 * This class uses the Singleton pattern to ensure that only one instance of the model is loaded.
 */
class PipelineSingleton {
  static model_id = "onnx-community/whisper-base_timestamped";
  static instance = null;

  static async getInstance(progress_callback = null, device = "webgpu") {
    if (!this.instance) {
      this.instance = pipeline("automatic-speech-recognition", this.model_id, {
        ...PER_DEVICE_CONFIG[device],
        progress_callback,
      });
    }
    return this.instance;
  }
}

async function load({ device }) {
  self.postMessage({
    status: "loading",
    data: `Loading model (${device})...`,
  });

  // Load the pipeline and save it for future use.
  const transcriber = await PipelineSingleton.getInstance((x) => {
    // We also add a progress callback to the pipeline so that we can
    // track model loading.
    self.postMessage(x);
  }, device);

  if (device === "webgpu") {
    self.postMessage({
      status: "loading",
      data: "Compiling shaders and warming up model...",
    });

    await transcriber(new Float32Array(16_000), {
      language: "en",
      task: "transcribe",
    });
  }

  self.postMessage({ status: "ready" });
}

async function run({ audio, sourceLanguage, targetLanguage, task }) {
  const transcriber = await PipelineSingleton.getInstance();

  const start = performance.now();

  // Determine the task and language settings
  let whisperTask = "transcribe";
  let whisperLanguage = sourceLanguage;
  let note = null;

  if (task === "translate") {
    if (targetLanguage === "en") {
      // Standard translation to English
      whisperTask = "translate";
      whisperLanguage = sourceLanguage;
    } else {
      // For translation to non-English languages, we use a workaround:
      // Set task to "transcribe" but language to target language
      // This leverages Whisper's cross-lingual capabilities
      whisperTask = "transcribe";
      whisperLanguage = targetLanguage;
      note = `Translating from ${sourceLanguage} to ${targetLanguage} using cross-lingual transcription`;
    }
  } else {
    // Standard transcription
    whisperLanguage = sourceLanguage;
  }

  const result = await transcriber(audio, {
    language: whisperLanguage,
    task: whisperTask,
    return_timestamps: "word",
    chunk_length_s: 30,
  });

  const end = performance.now();

  // Add metadata about the processing
  const processedResult = {
    ...result,
    sourceLanguage,
    targetLanguage,
    task,
    actualTask: whisperTask,
    actualLanguage: whisperLanguage,
    note
  };

  self.postMessage({ 
    status: "complete", 
    result: processedResult, 
    time: end - start 
  });
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  console.log(e.data);

  switch (type) {
    case "load":
      load(data);
      break;

    case "run":
      run(data);
      break;
  }
});