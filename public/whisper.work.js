import { pipeline, env } from '@huggingface/transformers';

// Due to a bug in onnxruntime-web, we must disable multithreading for now.
// It's possible the original obfuscated code had a custom build or workaround.
// For browser-based Whisper, `Xenova` models are optimized for WASM.
env.allowLocalModels = false; // Prevents loading from a local `models` folder for simplicity
env.use='wasm'; // Ensure WASM is used

let transcriber = null; // Store the pipeline for reuse

self.onmessage = async (event) => {
    const { type, audio, model_name } = event.data;

    if (type === 'INFERENCE_REQUEST') {
        if (!transcriber) {
            self.postMessage({ type: 'LOADING', status: 'loading' });
            try {
                // Initial load of the model
                transcriber = await pipeline('automatic-speech-recognition', model_name);
                self.postMessage({ type: 'LOADING', status: 'success' });
            } catch (error) {
                self.postMessage({ type: 'LOADING', status: 'error', message: error.message });
                return;
            }
        }

        self.postMessage({ type: 'DOWNLOADING' }); // Indicate that processing is starting

        try {
            // Perform transcription
            const transcriptionResult = await transcriber(audio, {
                chunk_length_s: 30, // Process audio in 30-second chunks
                stride_length_s: 5, // Overlap chunks by 5 seconds for smoother transitions
                return_timestamps: true, // Crucial for interactive highlighting
                callback_function: (data) => {
                    // Send partial results back to the main thread for real-time updates
                    self.postMessage({ type: 'RESULT_PARTIAL', result: data.chunks.slice(-1)[0] });
                    // Also send full results and progress
                    self.postMessage({
                        type: 'RESULT',
                        results: data.chunks,
                        completedUntilTimestamp: data.status === 'update' ? data.chunks.slice(-1)[0].end : audio.duration
                    });
                }
            });

            self.postMessage({ type: 'INFERENCE_DONE', results: transcriptionResult });

        } catch (error) {
            console.error('Transcription failed:', error);
            self.postMessage({ type: 'LOADING', status: 'error', message: 'Transcription failed: ' + error.message });
        }
    }
};

// Handle worker termination for cleanup
self.onclose = () => {
    if (transcriber) {
        transcriber = null; // Release resources
    }
    console.log('Whisper worker terminated.');
};