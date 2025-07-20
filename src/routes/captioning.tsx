import { LanguageSelector } from "@/components/LanguageSelector";
import MediaInput from "@/components/MediaInput";
import Progress from "@/components/Progress";
import { RequirementsTooltip } from "@/components/RequirementsTooltip";
import Transcript from "@/components/Transcript";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { downloadSRT } from "@/utils/format-srt";
import { titleCase } from "@/utils/title-case";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Import SRT utility functions

export const Route = createFileRoute("/captioning")({
  component: RouteComponent,
});

declare global {
  interface Navigator {
    readonly gpu: GPU;
  }
}

async function hasWebGPU() {
  if (!navigator.gpu) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (e: unknown) {
    return false;
  }
}

const requirements = [
  {
    type: "Hardware",
    description:
      "This feature runs a 73 million parameter model. WebGPU is recommended for better performance. The system will automatically detect and use the best available hardware (WebGPU or WebAssembly).",
  },
  {
    type: "Browser",
    description:
      "A modern browser with support for WebGPU (e.g., Chrome, Edge) is recommended for optimal performance.",
  },
  {
    type: "Network",
    description:
      "A stable internet connection is required to download the AI model (approx. 77-196 MB) from Hugging Face.",
  },
  {
    type: "API/Model",
    description:
      "This feature uses the onnx-community/whisper-base_timestamped model from Hugging Face for transcription and translation.",
  },
];

function RouteComponent() {
  // Create a reference to the worker object.
  const worker = useRef<Worker | null>(null);

  // Model loading and progress
  const [status, setStatus] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressItems, setProgressItems] = useState([]);

  const mediaInputRef = useRef(null);
  const [audio, setAudio] = useState(null);

  // Language and task settings
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [task, setTask] = useState("transcribe"); // "transcribe" or "translate"

  const [result, setResult] = useState(null);
  const [time, setTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

  const [device, setDevice] = useState("webgpu"); // Try use WebGPU first

  useEffect(() => {
    hasWebGPU().then((result) => {
      setDevice(result ? "webgpu" : "wasm");
    });
  }, []);

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    // Create the worker if it does not yet exist.
    worker.current ??= new Worker(
      new URL("../lib/captioning/worker.js", import.meta.url),
      {
        type: "module",
      }
    );

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "loading":
          // Model file start load: add a new progress item to the list.
          setStatus("loading");
          setLoadingMessage(e.data.data);
          break;

        case "initiate":
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            })
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file)
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setStatus("ready");
          break;

        case "complete":
          console.log("Result: ", e.data.result);
          setResult(e.data.result);
          setTime(e.data.time);
          setStatus("ready");
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current?.removeEventListener("message", onMessageReceived);
    };
  }, []);

  const handleClick = useCallback(() => {
    setResult(null);
    setTime(null);
    if (status === null) {
      setStatus("loading");
      worker.current?.postMessage({ type: "load", data: { device } });
    } else {
      setStatus("running");
      worker.current?.postMessage({
        type: "run",
        data: {
          audio,
          sourceLanguage,
          targetLanguage,
          task,
        },
      });
    }
  }, [status, audio, sourceLanguage, targetLanguage, task, device]);

  // Function to handle SRT download
  const handleDownloadSRT = useCallback(() => {
    if (!result) return;

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
    const baseFilename = `subtitles_${timestamp}`;
    downloadSRT(result, baseFilename);
  }, [result]);

  // Auto-set target language to English when translation is selected
  useEffect(() => {
    if (task === "translate" && sourceLanguage === targetLanguage) {
      // If source and target are the same when switching to translate, default to English
      setTargetLanguage("en");
    }
  }, [task, sourceLanguage, targetLanguage]);

  return (
    <div className="w-screen h-screen">
      <div className="flex flex-col mx-auto items justify-end max-w-[560px] h-full">
        <div className="h-full flex items-center flex-col relative">
          <div className="text-center flex justify-center items-center flex-col gap-2 mb-8 mt-6">
            <h1 className="text-2xl font-bold">
              Audio/Video Captioning & Translation
            </h1>
            <h2 className="text-xl font-semibold mb-2">
              Generate and download SRT subtitles for video or audio
            </h2>
            <RequirementsTooltip requirements={requirements} />
          </div>

          <div className="w-full min-h-[220px] flex flex-col justify-center items-center p-2">
            {status === "loading" && (
              <div className="w-[500px] my-2">
                <p className="text-center mb-2 text-md">{loadingMessage}</p>
                {progressItems.map(({ file, progress, total }, i) => (
                  <Progress
                    key={i}
                    text={file}
                    percentage={progress}
                    total={total}
                  />
                ))}
              </div>
            )}

            {!audio && status !== "loading" && (
              <p className="mb-2">
                You are about to download{" "}
                <a
                  href="https://huggingface.co/onnx-community/whisper-base_timestamped"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  whisper-base (timestamped)
                </a>
                , a 73 million parameter speech recognition model with the
                ability to generate word-level timestamps and translate across
                100 different languages.
              </p>
            )}

            <div className="flex flex-col w-full m-3">
              <span className="text-sm mb-0.5">Input audio/video</span>
              <MediaInput
                ref={mediaInputRef}
                className="flex items-center border rounded-md cursor-pointer min-h-[100px] max-h-[500px] overflow-hidden"
                onInputChange={(result) => setAudio(result)}
                onTimeUpdate={(time) => setCurrentTime(time)}
              />
            </div>

            {status !== null && (
              <div className="w-full flex flex-row gap-5 mb-4 justify-center">
                {/* Task Selection */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm min-w-[60px]">Task:</span>
                  <DropdownMenu>
                    {/* value={task} onValueChange={setTask} */}
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-42 justify-between"
                        aria-label="Select task"
                      >
                        <span className="flex w-full items-center justify-between">
                          {titleCase(task)}
                          <ChevronDown size={15} />
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => setTask("transcribe")}>
                        Transcribe (same language)
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setTask("translate")}>
                        Translate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Source Language */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm min-w-[60px]">Source:</span>
                  <LanguageSelector
                    language={sourceLanguage}
                    setLanguage={setSourceLanguage}
                  />
                </div>

                {/* Target Language */}
                {task === "translate" && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm min-w-[60px]">Target:</span>
                    <LanguageSelector
                      language={targetLanguage}
                      setLanguage={setTargetLanguage}
                    />
                  </div>
                )}
              </div>
            )}
            {/* Show info about translation capabilities */}
            {task === "translate" && targetLanguage !== "en" && (
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded-md mb-2">
                <strong>Translation to {targetLanguage}:</strong> Using
                Whisper's cross-lingual capabilities. For best results, try
                translating to English first.
              </div>
            )}

            <div className="relative w-full flex justify-center items-center gap-2">
              <Button
                className="bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed select-none cursor-pointer"
                onClick={handleClick}
                disabled={
                  status === "running" || (status !== null && audio === null)
                }
              >
                {status === null
                  ? "Load model"
                  : status === "running"
                    ? "Running..."
                    : task === "transcribe"
                      ? "Transcribe"
                      : "Translate"}
              </Button>
            </div>

            {result && time && (
              <>
                <div className="w-full mt-4 border rounded-md">
                  <Transcript
                    className="p-2 max-h-[200px] overflow-y-auto scrollbar-thin select-none"
                    transcript={result}
                    handleDownloadSRT={handleDownloadSRT}
                    currentTime={currentTime}
                    setCurrentTime={(time) => {
                      setCurrentTime(time);
                      mediaInputRef.current?.setMediaTime(time);
                    }}
                  />
                </div>

                {/* {result.note && (
                  <div className="w-full mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">{result.note}</p>
                  </div>
                )} */}

                <div className="flex justify-between items-center w-full mt-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">
                      {result.task === "translate"
                        ? "Translated"
                        : "Transcribed"}
                    </span>
                    {" from "}
                    {result.sourceLanguage}
                    {" to "}
                    {result.targetLanguage}
                    {result.actualTask === "translate" &&
                      result.targetLanguage === "en" &&
                      " (native translation)"}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Generation time:{" "}
                    <span className="text-gray-800 dark:text-gray-200 font-semibold">
                      {time.toFixed(2)}ms
                    </span>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
