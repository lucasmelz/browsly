import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Play, Download, ChevronDown, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import Progress from "@/components/Progress";

export const Route = createFileRoute("/text-to-speech")({
  component: RouteComponent,
});



type Source = "browser" | "model";

function RouteComponent() {
  const [text, setText] = useState(
    "I have a dream that one day this nation will rise up and live out the true meaning of its creed."
  );
  const [source, setSource] = useState<Source>("browser");

  // Browser API state
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>(
    []
  );
  const [selectedBrowserVoice, setSelectedBrowserVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-US");

  // Model state
  const [modelStatus, setModelStatus] = useState("unloaded");
  const [progress, setProgress] = useState({
    files: {} as Record<string, { loaded: number; total: number }>,
    totalLoaded: 0,
    totalSize: 0,
    percentage: 0,
    currentFile: "",
    status: "",
    model: "",
  });

  
  const [audioData, setAudioData] = useState<Float32Array | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const worker = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setBrowserVoices(availableVoices);
      if (availableVoices.length > 0) {
        const defaultVoice = availableVoices.find((v) => v.lang === "en-US");
        setSelectedBrowserVoice(defaultVoice || availableVoices[0]);
      }
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    worker.current = new Worker(
      new URL("../lib/text-to-speech/worker.js", import.meta.url),
      {
        type: "module",
      }
    );

    worker.current.onmessage = (e) => {
      const { type, ...data } = e.data;
      switch (type) {
        case "progress":
          if (
            typeof data.loaded === "number" &&
            typeof data.total === "number"
          ) {
            setProgress((prev) => {
              const files = { ...prev.files };
              const oldFile = files[data.file] || { loaded: 0, total: 0 };

              const totalSize = prev.totalSize - oldFile.total + data.total;
              const totalLoaded =
                prev.totalLoaded - oldFile.loaded + data.loaded;

              files[data.file] = { loaded: data.loaded, total: data.total };

              return {
                ...prev,
                files,
                totalLoaded,
                totalSize,
                percentage: totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0,
                currentFile: data.file,
                status: data.status,
                model: data.model,
              };
            });
          } else {
            setProgress((prev) => ({
              ...prev,
              currentFile: data.file,
              status: data.status,
              model: data.model,
            }));
          }
          break;
        case "ready":
          setModelStatus("ready");
          setProgress((prev) => ({ ...prev, status: "ready" }));
          break;
        case "result":
          setIsPlaying(true);
          setAudioData(data.speech.audio);
          playAudio(data.speech.audio);
          break;
      }
    };

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
      worker.current?.terminate();
    };
  }, []);

  const languages = Array.from(new Set(browserVoices.map((v) => v.lang))).map(
    (lang) => {
      let displayName = lang;
      try {
        const langName = new Intl.DisplayNames(["en"], { type: "language" }).of(
          lang.split("-")[0]
        );
        if (lang.includes("-")) {
          const regionName = new Intl.DisplayNames(["en"], {
            type: "region",
          }).of(lang.split("-")[1]);
          displayName = `${langName} (${regionName})`;
        } else {
          displayName = langName || lang;
        }
      } catch (e) {
        console.warn(`Could not get display name for language: ${lang}`, e);
      }
      return { code: lang, name: displayName };
    }
  );

  const handleLanguageChange = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    const voiceForLanguage = browserVoices.find((v) => v.lang === languageCode);
    setSelectedBrowserVoice(voiceForLanguage || null);
  };

  const handleSourceChange = (newSource: Source) => {
    setSource(newSource);
    if (newSource === "model" && modelStatus === "unloaded") {
      setModelStatus("loading");
      worker.current?.postMessage({ type: "init" });
    }
  };

  const playAudio = (audioData: Float32Array) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    }
    const audioContext = audioContextRef.current;
    const buffer = audioContext.createBuffer(
      1,
      audioData.length,
      audioContext.sampleRate
    );
    buffer.getChannelData(0).set(audioData);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      setIsPlaying(false);
    };
    source.start();
  };

  const handlePlay = () => {
    if (!text) return;

    if (source === "browser" && selectedBrowserVoice) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selectedBrowserVoice;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        setIsPlaying(false);
      };
      window.speechSynthesis.speak(utterance);
    } else if (source === "model" && modelStatus === "ready") {
      worker.current?.postMessage({
        type: "generate",
        text,
        speaker_id: 0,
      });
    }
  };

  const handleStop = () => {
    if (source === "browser") {
      window.speechSynthesis.cancel();
    } else {
      audioContextRef.current?.close();
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleDownload = () => {
    if (!audioData) {
      alert("Please generate the audio first by clicking the play button.");
      return;
    }
    const buffer = new ArrayBuffer(44 + audioData.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + audioData.length * 2, true);
    writeString(view, 8, "WAVE");
    // fmt chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true);
    view.setUint32(28, 16000 * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // data chunk
    writeString(view, 36, "data");
    view.setUint32(40, audioData.length * 2, true);

    // audio data
    let offset = 44;
    for (let i = 0; i < audioData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const blob = new Blob([view], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "speech.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  const isPlayDisabled =
    !text ||
    (source === "browser" && !selectedBrowserVoice) ||
    (source === "model" && modelStatus !== "ready");

  return (
    <div className="max-w-4xl mx-auto p-6 text-center">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Text-to-Speech</h1>
        <h2 className="text-xl font-semibold">
          Type in text, select a source and voice, and play or download the
          audio.
        </h2>
      </div>

      <div className="grid w-full gap-4">
        <div className="grid w-full gap-1.5">
          <Label htmlFor="message">Your Message</Label>
          <Textarea
            placeholder="Type your message here."
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[150px]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="block text-sm font-medium mb-2">
              Audio Source
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {source === "browser" ? "Browser's API" : "AI Model (Xenova/speecht5_tts)"}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem
                  onSelect={() => handleSourceChange("browser")}
                >
                  Browser's API
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleSourceChange("model")}>
                  AI Model (Xenova/speecht5_tts)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {source === "browser" ? (
            <>
              <div>
                <Label className="block text-sm font-medium mb-2">
                  Language
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {languages.find((l) => l.code === selectedLanguage)
                        ?.name || "Select Language"}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onSelect={() => handleLanguageChange(lang.code)}
                      >
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div>
                <Label className="block text-sm font-medium mb-2">Voice</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      disabled={!selectedLanguage}
                    >
                      {selectedBrowserVoice?.name || "Select Voice"}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                    {browserVoices
                      .filter((v) => v.lang === selectedLanguage)
                      .map((voice) => (
                        <DropdownMenuItem
                          key={voice.name}
                          onSelect={() => setSelectedBrowserVoice(voice)}
                        >
                          {voice.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : null}
        </div>

        {source === "model" && modelStatus === "loading" && (
          <div className="mt-4">
            <Progress
              text={progress.status}
              percentage={progress.percentage}
              total={progress.totalSize}
              model={progress.model}
              status={progress.status}
              file={""}
            />
          </div>
        )}

        <div className="flex justify-center gap-4 mt-4">
          {isPlaying ? (
            <Button onClick={handleStop} variant="destructive">
              <Square className="w-5 h-5 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={handlePlay} disabled={isPlayDisabled}>
              <Play className="w-5 h-5 mr-2" />
              Play
            </Button>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-block">
                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    disabled={source === "browser"}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download
                  </Button>
                </div>
              </TooltipTrigger>
              {source === "browser" && (
                <TooltipContent>
                  <p>
                    Download is only available when using the AI Model source.
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
