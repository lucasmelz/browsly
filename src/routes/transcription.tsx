import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Upload,
  Mic,
  MicOff,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import Progress from "@/components/Progress";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { RequirementsTooltip } from "@/components/RequirementsTooltip";

export const Route = createFileRoute("/transcription")({
  component: RouteComponent,
});

interface ProgressState {
  text: string;
  percentage: number;
}

interface WorkerMessage {
  type: "progress" | "ready" | "processing" | "result" | "error";
  text?: string;
  error?: string;
  percentage?: number;
}

interface WorkerRequest {
  type: "init" | "translate";
  audioData?: number[];
  targetLanguage?: string;
  modelName?: string;
}

type TranscriptionStatus =
  | "initializing"
  | "ready"
  | "recording"
  | "processing"
  | "completed"
  | "error";

interface Language {
  code: string;
  name: string;
}

interface WhisperModel {
  name: string;
  displayName: string;
  size: string;
  description: string;
}

// Audio Visualizer Component
const AudioVisualizer = ({
  isRecording,
  audioLevel = 0,
}: {
  isRecording: boolean;
  audioLevel: number;
}) => (
  <div className="flex items-center justify-center space-x-1 h-8">
    {[...Array(5)].map((_, i) => (
      <div
        key={i}
        className={`w-1 bg-blue-500 rounded-full transition-all duration-150 ${
          isRecording ? "animate-pulse" : ""
        }`}
        style={{
          height: isRecording ? `${Math.max(8, audioLevel * 32)}px` : "8px",
          opacity: isRecording ? 0.7 + audioLevel * 0.3 : 0.3,
        }}
      />
    ))}
  </div>
);

const SUPPORTED_LANGUAGES = [
  { code: "auto", name: "Auto detect" },
  { code: "af", name: "Afrikaans" },
  { code: "ar", name: "Arabic" },
  { code: "hy", name: "Armenian" },
  { code: "az", name: "Azerbaijani" },
  { code: "be", name: "Belarusian" },
  { code: "bs", name: "Bosnian" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "zh", name: "Chinese" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "gl", name: "Galician" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "ko", name: "Korean" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mk", name: "Macedonian" },
  { code: "ms", name: "Malay" },
  { code: "mr", name: "Marathi" },
  { code: "mi", name: "Māori" },
  { code: "ne", name: "Nepali" },
  { code: "no", name: "Norwegian" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sr", name: "Serbian" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "tl", name: "Tagalog" },
  { code: "ta", name: "Tamil" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "vi", name: "Vietnamese" },
  { code: "cy", name: "Welsh" },
];

const WHISPER_MODELS: WhisperModel[] = [
  {
    name: "Xenova/whisper-tiny",
    displayName: "Tiny",
    size: "~37 MB",
    description: "Fastest, least accurate",
  },
  {
    name: "Xenova/whisper-base",
    displayName: "Base",
    size: "~140 MB",
    description: "Good balance of speed and accuracy",
  },
  {
    name: "Xenova/whisper-small",
    displayName: "Small",
    size: "~240 MB",
    description: "Better accuracy, slower",
  },
];

const requirements = [
  {
    type: "Hardware",
    description:
      "A microphone is required for recording audio. A modern CPU is recommended for faster transcription, especially with larger models.",
  },
  {
    type: "Browser",
    description:
      "A modern browser with support for the MediaRecorder API (for recording) and Web Workers is required.",
  },
  {
    type: "Network",
    description:
      "A stable internet connection is needed to download the selected Whisper model from Hugging Face (approx. 37-240 MB).",
  },
  {
    type: "API/Model",
    description:
      "This feature uses a choice of Whisper models (Tiny, Base, Small) from Hugging Face, executed in the browser via Transformers.js.",
  },
];

function RouteComponent() {
  // Refs with proper types
  const workerRef = useRef<Worker | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // State with proper types
  const [status, setStatus] = useState<TranscriptionStatus>("initializing");
  const [result, setResult] = useState<string>("");
  const [recording, setRecording] = useState<boolean>(false);
  const [targetLanguage, setTargetLanguage] = useState<string>("en");
  const [selectedModel, setSelectedModel] = useState<string>(
    "Xenova/whisper-base"
  );
  const [currentLoadedModel, setCurrentLoadedModel] = useState<string | null>(
    null
  );
  const [progress, setProgress] = useState<ProgressState>({
    text: "",
    percentage: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const cleanupRecording = useCallback((): void => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  // Initialize worker and load initial model
  useEffect(() => {
    const initializeWorker = (): void => {
      try {
        // Initialize worker using proper module import
        workerRef.current ??= new Worker(
          new URL("../lib/transcription/worker", import.meta.url),
          {
            type: "module",
          }
        );

        // Set up worker message handler with proper typing
        workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
          const { type, text, error, percentage } = e.data;

          switch (type) {
            case "progress":
              if (text !== undefined && percentage !== undefined) {
                setProgress({ text, percentage });
              }
              break;
            case "ready":
              setIsLoading(false);
              setStatus("ready");
              setError(null);
              setCurrentLoadedModel(selectedModel);
              break;
            case "processing":
              setStatus("processing");
              break;
            case "result":
              setStatus("completed");
              if (text !== undefined) {
                setResult(text);
              }
              break;
            case "error":
              setStatus("error");
              if (error !== undefined) {
                setError(error);
              }
              setIsLoading(false);
              console.error("Worker error:", error);
              break;
            default:
              console.warn("Unknown worker message type:", type);
          }
        };

        // Worker error handler
        workerRef.current.onerror = (error: ErrorEvent) => {
          const errorMessage = `Worker error: ${error.message}`;
          setError(errorMessage);
          setStatus("error");
          setIsLoading(false);
          console.error("Worker error event:", error);
        };

        // Initialize the worker with selected model
        const initMessage: WorkerRequest = {
          type: "init",
          modelName: selectedModel,
        };
        workerRef.current.postMessage(initMessage);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown initialization error";
        setError(`Failed to initialize: ${errorMessage}`);
        setStatus("error");
        setIsLoading(false);
        console.error("Worker initialization error:", err);
      }
    };

    initializeWorker();

    // Cleanup function
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      // Clear duration interval on component unmount
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      cleanupRecording();
    };
  }, [cleanupRecording, selectedModel]);

  // Handle model changes
  useEffect(() => {
    // Only reload if we have a worker and the model actually changed
    if (
      workerRef.current &&
      currentLoadedModel &&
      selectedModel !== currentLoadedModel
    ) {
      setIsLoading(true);
      setStatus("initializing");
      setError(null);
      setProgress({ text: "", percentage: 0 });

      const initMessage: WorkerRequest = {
        type: "init",
        modelName: selectedModel,
      };
      workerRef.current.postMessage(initMessage);
    }
  }, [selectedModel, currentLoadedModel]);

  // Audio level monitoring with proper typing
  const updateAudioLevel = useCallback((): void => {
    if (analyserRef.current && recording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [recording]);

  // Convert audio to the format expected by Whisper
  const processAudioForWhisper = async (
    audioBuffer: ArrayBuffer
  ): Promise<Float32Array> => {
    try {
      const audioContext = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
      const audioData = await audioContext.decodeAudioData(audioBuffer);

      // console.log("Decoded audio data:", {
      //   sampleRate: audioData.sampleRate,
      //   length: audioData.length,
      //   duration: audioData.duration,
      //   channels: audioData.numberOfChannels,
      // });

      // Resample to 16kHz mono (Whisper's expected format)
      const targetSampleRate = 16000;
      const ratio = audioData.sampleRate / targetSampleRate;
      const length = Math.floor(audioData.length / ratio);
      const result = new Float32Array(length);

      // Get mono channel data
      const inputData = audioData.getChannelData(0);

      // Resample the audio
      for (let i = 0; i < length; i++) {
        const index = Math.floor(i * ratio);
        result[i] = inputData[index];
      }

      // console.log("Processed audio for Whisper:", {
      //   originalSampleRate: audioData.sampleRate,
      //   targetSampleRate: targetSampleRate,
      //   originalLength: audioData.length,
      //   resampledLength: result.length,
      //   duration: result.length / targetSampleRate,
      //   dataType: result.constructor.name,
      //   sample: Array.from(result.slice(0, 10)),
      // });

      // Validate the result
      if (result.length === 0) {
        throw new Error("Processed audio data is empty");
      }

      if (!result.every((val) => typeof val === "number" && isFinite(val))) {
        throw new Error("Processed audio contains invalid values");
      }

      // Clean up audio context
      if (audioContext.state !== "closed") {
        await audioContext.close();
      }

      return result;
    } catch (err) {
      console.error("Audio processing error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Audio processing failed";
      throw new Error(`Audio processing error: ${errorMessage}`);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target?.files?.[0];
    if (!file || !workerRef.current) return;

    try {
      setStatus("processing");
      setError(null);
      setResult("");

      const buffer = await file.arrayBuffer();
      const audioData = await processAudioForWhisper(buffer);

      // Create audio element for playback
      const audioUrl = URL.createObjectURL(file);
      setCurrentAudio(audioUrl);

      const transcribeMessage: WorkerRequest = {
        type: "translate",
        audioData: Array.from(audioData),
        targetLanguage: targetLanguage === "auto" ? undefined : targetLanguage,
      };

      workerRef.current.postMessage(transcribeMessage);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "File processing failed";
      setError(`File processing error: ${errorMessage}`);
      setStatus("error");
    } finally {
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  // Replace your startRecording function with this fixed version:
  const startRecording = async (): Promise<void> => {
    try {
      setError(null);
      setResult("");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analysis
      audioContextRef.current = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // Check if MediaRecorder supports the preferred format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      const chunks: BlobPart[] = [];
      const startTime = Date.now();

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
          const buffer = await blob.arrayBuffer();
          const audioData = await processAudioForWhisper(buffer);

          // Create audio for playback
          const audioUrl = URL.createObjectURL(blob);
          setCurrentAudio(audioUrl);

          setStatus("processing");

          if (workerRef.current) {
            const transcribeMessage: WorkerRequest = {
              type: "translate",
              audioData: Array.from(audioData),
              targetLanguage:
                targetLanguage === "auto" ? undefined : targetLanguage,
            };
            workerRef.current.postMessage(transcribeMessage);
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Recording processing failed";
          setError(`Recording processing error: ${errorMessage}`);
          setStatus("error");
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = (event as any).error || "Recording error occurred";
        setError(`MediaRecorder error: ${error}`);
        setStatus("error");
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      setStatus("recording");

      // FIXED: Start duration timer using setInterval instead of setTimeout
      // Clear any existing interval first
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Reset duration counter
      setRecordingDuration(0);

      // Start the interval timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);

      updateAudioLevel();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Recording failed to start";
      setError(`Recording error: ${errorMessage}`);
      setStatus("error");
      cleanupRecording();
    }
  };

  const stopRecording = (): void => {
    setRecording(false);
    setRecordingDuration(0);

    // FIXED: Clear the duration interval here
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    cleanupRecording();
  };

  const toggleAudioPlayback = (): void => {
    if (!currentAudio) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(false);
      return;
    }

    const audio = new Audio(currentAudio);
    currentAudioRef.current = audio;

    audio.onended = () => {
      setIsPlaying(false);
      currentAudioRef.current = null;
    };

    audio.onerror = (e) => {
      console.error("Audio playback error:", e);
      setIsPlaying(false);
      currentAudioRef.current = null;
    };

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error("Failed to play audio:", err);
        setIsPlaying(false);
        currentAudioRef.current = null;
      });
  };

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(result);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = result;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const getStatusIcon = (): ReactNode => {
    switch (status) {
      case "ready":
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "processing":
      case "recording":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSelectedModelInfo = (): WhisperModel | undefined => {
    return WHISPER_MODELS.find((model) => model.name === selectedModel);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-center relative">
      <div className="text-center flex justify-center items-center flex-col gap-2 mb-8">
        <h1 className="text-2xl font-bold">Audio Transcription</h1>
        <h2 className="text-xl font-semibold mb-2 text-muted-foreground">
        Upload audio files or record directly to get transcriptions
        </h2>
        <RequirementsTooltip requirements={requirements} />
      </div>

      {/* Status Section */}
      <div className="h-20 gap-2 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center space-x-2">
          {getStatusIcon()}
          <span className="font-medium capitalize">
            {status.replace("-", " ")}
          </span>
          {recording && (
            <span className="text-sm">
              ({formatDuration(recordingDuration)})
            </span>
          )}
        </div>

        {isLoading && (
          <Progress text={progress.text} percentage={progress.percentage} />
        )}

        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Model Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Whisper Model:</label>

        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            disabled={recording || status === "processing" || isLoading}
          >
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-label="Select language"
            >
              <span className="flex w-full items-center justify-between">
                {selectedModel}
                <ChevronDown
                  size={15}
                />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
            {WHISPER_MODELS.map((model: WhisperModel) => (
              <DropdownMenuItem
                key={model.displayName}
                className="w-[--radix-dropdown-menu-trigger-width]"
                onSelect={() => setSelectedModel(model.name)}
              >
                {model.displayName} ({model.size}) - {model.description}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {getSelectedModelInfo() && (
          <div className="mt-2 text-sm">
            <strong>Current model:</strong>{" "}
            {getSelectedModelInfo()?.displayName} -{" "}
            {getSelectedModelInfo()?.description}
          </div>
        )}
      </div>

      {/* Language Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Target Language:
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            disabled={recording || status === "processing"}
          >
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-label="Select language"
            >
              <span className="flex w-full items-center justify-between">
                {
                  SUPPORTED_LANGUAGES.find(
                    (language) => language.code === targetLanguage
                  )?.name
                }
                <ChevronDown
                  size={15}
                />
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
            <DropdownMenuItem
              className="w-[--radix-dropdown-menu-trigger-width]"
              onSelect={() => setTargetLanguage("auto")}
            >
              Auto-detect
            </DropdownMenuItem>
            {SUPPORTED_LANGUAGES.map((lang: Language) => (
              <DropdownMenuItem
                key={lang.code}
                className="w-[--radix-dropdown-menu-trigger-width]"
                onSelect={() => setTargetLanguage(lang.code)}
              >
                {lang.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Recording Section */}
      <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
        <div className="text-center">
          <div className="mb-4">
            <AudioVisualizer isRecording={recording} audioLevel={audioLevel} />
          </div>

          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={isLoading || status === "processing"}
            className={`inline-flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              recording
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
            }`}
          >
            {recording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            <span>{recording ? "Stop Recording" : "Start Recording"}</span>
          </button>
        </div>
      </div>

      {/* File Upload Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Or upload an audio file:
        </label>
        <div className="relative">
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            disabled={recording || status === "processing"}
            className="hidden"
            id="audio-upload"
          />
          <label
            htmlFor="audio-upload"
            className={`flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors ${
              recording || status === "processing"
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            <Upload className="w-6 h-6 mr-2" />
            <span>Choose audio file</span>
          </label>
        </div>
      </div>

      {/* Audio Playback */}
      {currentAudio && (
        <div className="mb-6 rounded-lg ">
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={toggleAudioPlayback}
              className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white" />
              )}
            </button>
            <span className="text-sm">
              {isPlaying ? "Playing audio..." : "Play recorded/uploaded audio"}
            </span>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">
            Transcription Result:
          </h3>
          <p className="text-green-700 leading-relaxed whitespace-pre-wrap">
            {result}
          </p>
          <button
            onClick={copyToClipboard}
            className="mt-2 text-sm text-green-600 hover:text-green-800 underline transition-colors"
          >
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
