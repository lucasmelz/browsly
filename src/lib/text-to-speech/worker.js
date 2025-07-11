import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

class TextToSpeechPipeline {
  static task = 'text-to-speech';
  static model = 'Xenova/speecht5_tts';
  static speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, {
        progress_callback,
      });
    }

    return this.instance;
  }
}

self.onmessage = async (event) => {
  const { type, text } = event.data;

  const progress_callback = (data) => {
    self.postMessage({ 
        type: 'progress', 
        ...data, 
        model: TextToSpeechPipeline.model 
    });
  }

  if (type === 'init') {
    await TextToSpeechPipeline.getInstance(progress_callback);
    self.postMessage({ type: 'ready' });
    return;
  }

  if (type === 'generate') {
    const synthesizer = await TextToSpeechPipeline.getInstance();
    const speaker_embeddings = TextToSpeechPipeline.speaker_embeddings;
    const speech = await synthesizer(text, {
        speaker_embeddings
    });

    self.postMessage({ type: 'result', speech });
  }
};
