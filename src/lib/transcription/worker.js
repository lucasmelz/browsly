import { pipeline } from '@huggingface/transformers';

let model = null;
let currentModelName = null;
let fileProgress = new Map(); // Track bytes loaded/total for each file
let completedFiles = new Set(); // Track completed files
let totalFiles = 0; // Track total number of files

self.onmessage = async (e) => {
    const { type, audioData, targetLanguage, modelName } = e.data;

    if (type === 'init') {
        try {
            const requestedModel = modelName || 'Xenova/whisper-base';
            
            // Only load a new model if it's different from the current one
            if (!model || currentModelName !== requestedModel) {
                self.postMessage({ 
                    type: 'progress', 
                    text: `Loading ${requestedModel}...`, 
                    percentage: 0 
                });

                // Clear existing model if we're switching
                if (model && currentModelName !== requestedModel) {
                    model = null;
                    currentModelName = null;
                    fileProgress.clear();
                    completedFiles.clear();
                    totalFiles = 0;
                }

                model = await pipeline('automatic-speech-recognition', requestedModel, {
                    task: 'translate',
                    progress_callback: (info) => {                        
                        if (info.file) {
                            // Track new files with byte information
                            if (!fileProgress.has(info.file)) {
                                fileProgress.set(info.file, { loaded: 0, total: 0 });
                                totalFiles++;
                            }

                            // Update progress with byte information
                            if (info.status === 'downloading' || info.status === 'loading' || info.status === 'progress') {
                                fileProgress.set(info.file, {
                                    loaded: info.loaded || 0,
                                    total: info.total || 0
                                });
                            } else if (info.status === 'ready' || info.status === 'done') {
                                // Mark file as completed - set loaded = total
                                const currentProgress = fileProgress.get(info.file) || { loaded: 0, total: 0 };
                                fileProgress.set(info.file, {
                                    loaded: currentProgress.total || currentProgress.loaded || 0,
                                    total: currentProgress.total || currentProgress.loaded || 0
                                });
                                completedFiles.add(info.file);
                            }

                            // Calculate total bytes loaded vs total bytes across all files
                            let totalBytesLoaded = 0;
                            let totalBytesOverall = 0;
                            
                            for (const [filename, progress] of fileProgress.entries()) {
                                totalBytesLoaded += progress.loaded;
                                totalBytesOverall += progress.total;
                            }

                            // Calculate percentage based on bytes
                            const bytesProgress = totalBytesOverall > 0 
                                ? (totalBytesLoaded / totalBytesOverall) * 100 
                                : 0;

                            // console.log('Progress state:', {
                            //     fileProgress: Object.fromEntries(fileProgress),
                            //     completedFiles: Array.from(completedFiles),
                            //     totalFiles,
                            //     totalBytesLoaded: `${(totalBytesLoaded / 1024 / 1024).toFixed(2)} MB`,
                            //     totalBytesOverall: `${(totalBytesOverall / 1024 / 1024).toFixed(2)} MB`,
                            //     bytesProgress: `${bytesProgress.toFixed(2)}%`
                            // });
                            
                            // Format progress message with MB information
                            let progressText = '';
                            const mbLoaded = (totalBytesLoaded / 1024 / 1024).toFixed(1);
                            const mbTotal = (totalBytesOverall / 1024 / 1024).toFixed(1);
                            
                            if (info.status === 'downloading' || info.status === 'progress') {
                                progressText = `Downloading model files: ${mbLoaded}/${mbTotal} MB (${completedFiles.size}/${totalFiles} files complete)`;
                            } else if (info.status === 'loading') {
                                progressText = `Loading ${info.name}: ${mbLoaded}/${mbTotal} MB`;
                            } else if (info.status === 'ready' || info.status === 'done') {
                                if (completedFiles.size === totalFiles) {
                                    progressText = `All files loaded successfully: ${mbTotal} MB`;
                                } else {
                                    progressText = `Loading model files: ${mbLoaded}/${mbTotal} MB (${completedFiles.size}/${totalFiles} files complete)`;
                                }
                            } else {
                                progressText = `Processing: ${mbLoaded}/${mbTotal} MB`;
                            }
                                        
                            self.postMessage({
                                type: 'progress',
                                text: progressText,
                                percentage: Math.round(bytesProgress)
                            });

                            // Clear tracking data when all files are complete
                            if (completedFiles.size === totalFiles && totalFiles > 0) {
                                // Small delay to ensure final progress is shown
                                setTimeout(() => {
                                    fileProgress.clear();
                                    completedFiles.clear();
                                    totalFiles = 0;
                                }, 100);
                            }
                        } else {
                            // Fallback for progress without file info
                            const progressText = info.name || 'Processing...';
                            const percentage = typeof info.progress === 'number' ? 
                                Math.round(info.progress) : 0;
                    
                            self.postMessage({
                                type: 'progress',
                                text: progressText,
                                percentage: percentage
                            });
                        }
                    },
                });

                currentModelName = requestedModel;
                
                self.postMessage({ 
                    type: 'progress', 
                    text: `${requestedModel} loaded successfully`, 
                    percentage: 100 
                });
            }
            
            self.postMessage({ type: 'ready' });
            
        } catch (error) {
            console.error('Model initialization error:', error);
            self.postMessage({ 
                type: 'error', 
                error: `Failed to load model: ${error.message}` 
            });
        }
        
    } else if (type === 'translate' && model && audioData) {
        try {
            self.postMessage({ type: 'processing' });

            // Ensure audioData is a proper Float32Array
            let audioFloat32;
            if (audioData instanceof Float32Array) {
                audioFloat32 = audioData;
            } else if (Array.isArray(audioData)) {
                audioFloat32 = new Float32Array(audioData);
            } else {
                throw new Error('Invalid audio data format');
            }

            // Validate the audio data
            if (audioFloat32.length === 0) {
                throw new Error('Audio data is empty');
            }

            // console.log('Audio data info:', {
            //     type: audioFloat32.constructor.name,
            //     length: audioFloat32.length,
            //     sample: audioFloat32.slice(0, 10),
            //     model: currentModelName
            // });

            // Perform transcription
            const options = {};
            if (targetLanguage && targetLanguage !== 'auto') {
                options.language = targetLanguage;
            }

            // console.log('Starting transcription with options:', options);
            
            const result = await model(audioFloat32, options);
            
            // console.log('Transcription completed:', {
            //     text: result.text,
            //     model: currentModelName
            // });
            
            self.postMessage({ type: 'result', text: result.text });

        } catch (error) {
            console.error('Transcription error:', error);
            self.postMessage({ 
                type: 'error', 
                error: `Transcription failed: ${error.message}` 
            });
        }
    } else if (type === 'translate' && !model) {
        self.postMessage({ 
            type: 'error', 
            error: 'Model not initialized. Please wait for initialization to complete.' 
        });
    }
};

// Handle worker errors
self.onerror = (error) => {
    console.error('Worker error:', error);
    self.postMessage({ 
        type: 'error', 
        error: `Worker error: ${error.message || 'Unknown error'}` 
    });
};