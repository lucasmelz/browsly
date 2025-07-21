import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { RequirementsTooltip } from "@/components/RequirementsTooltip";

export const Route = createFileRoute("/speech-to-text")({
  component: RouteComponent,
});

// --- TYPE DEFINITIONS ---

// Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

// Summarizer API
interface Summarizer {
  summarize(text: string): Promise<string>;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    Summarizer?: {
      create(): Promise<Summarizer>;
    };
  }
}

interface Language {
  code: string; // BCP 47 language tag
  name: string;
}

// --- CONSTANTS ---

const languages: Language[] = [
  { code: "en-US", name: "English (US)" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "fr-FR", name: "French (France)" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ru-RU", name: "Russian" },
  { code: "zh-CN", name: "Chinese (Mandarin)" },
];

const requirements = [
  {
    type: "Browser",
    description:
      "Google Chrome 138 or later.",
  },
  {
    type: "Platform",
    description: "Desktop platforms only (Windows, macOS, Linux).",
  },
  
  {
    type: "Hardware",
    description:
      "Requires a microphone, minimum pf 22 GB free disk space and 4+ GB VRAM.",
  },
];

function RouteComponent() {
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    languages[0]
  );
  const [error, setError] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // --- API INITIALIZATION & ERROR HANDLING ---
  useEffect(() => {
    const isSpeechSupported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    if (!isSpeechSupported) {
      setError(
        "Speech Recognition API is not supported in this browser. Please try Chrome or Edge."
      );
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Speech Recognition API is not supported in this browser. Please try Chrome or Edge."
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      // Append final results to existing text
      if (finalTranscript) {
        setText((prevText) => prevText.trim() + " " + finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(`Speech recognition error: ${event.error} - ${event.message}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // --- EVENT HANDLERS ---

  const handleLanguageChange = (code: string) => {
    const newLang = languages.find((l) => l.code === code);
    if (newLang) {
      setSelectedLanguage(newLang);
      if (isListening) {
        recognitionRef.current?.stop();
      }
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.lang = selectedLanguage.code;
        recognitionRef.current.start();
        setIsListening(true);
        setError("");
        setSummary("");
      }
    }
  };

  const handleSummarize = async () => {
    if (!text.trim()) {
      setError("There is no text to summarize.");
      return;
    }
    if (!("Summarizer" in window)) {
      setError(
        "The Summarizer API is not supported in this browser. Please try a compatible version of Chrome."
      );
      return;
    }

    setIsSummarizing(true);
    setError("");
    setSummary("");

    console.log(text);

    try {
      const summarizer = await window.Summarizer!.create();
      const result = await summarizer.summarize(text);
      setSummary(result);
    } catch (e) {
      setError(`Summarization failed: ${(e as Error).message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-center relative">
      <div className="text-center flex justify-center items-center flex-col gap-2 mb-8">
        <h1 className="text-2xl font-bold">Speech to Text & Summarization</h1>
        <h2 className="text-xl font-semibold mb-2">
          Transcribe your voice or type, then summarize the content.
        </h2>
        <RequirementsTooltip requirements={requirements} />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 relative flex justify-between items-center">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} aria-label="Close error">
            <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}

      <div className="grid w-full gap-4">
        {/* Language Selection */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <Label className="font-semibold">Recognition Language</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-64 justify-between">
                <span>{selectedLanguage.name}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 max-h-60 overflow-y-auto">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onSelect={() => handleLanguageChange(lang.code)}
                  className={
                    selectedLanguage.code === lang.code
                      ? "font-semibold bg-accent"
                      : ""
                  }
                >
                  {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Text Area and Controls */}
        <div className="relative grid w-full gap-1.5">
          <Label htmlFor="message">Your Text</Label>
          <Textarea
            placeholder="Click the microphone to start speaking, or type your message here."
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[250px] pb-10"
          />
          <div className="absolute bottom-2 left-2">
            <Button
              onClick={toggleListening}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
            >
              {isListening ? <MicOff /> : <Mic />}
              <span className="sr-only">
                {isListening ? "Stop listening" : "Start listening"}
              </span>
            </Button>
          </div>
          <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
            {text.length} characters
          </div>
        </div>

        {/* Summarize Button */}
        <div className="flex justify-center gap-4 mt-4">
          <Button
            onClick={handleSummarize}
            disabled={isSummarizing || !text.trim()}
          >
            {isSummarizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Summarizing...
              </>
            ) : (
              "Summarize Text"
            )}
          </Button>
        </div>

        {/* Summary Result */}
        {summary && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
            <h3 className="font-semibold text-green-800 mb-2">Summary:</h3>
            <p className="text-green-700 leading-relaxed whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
