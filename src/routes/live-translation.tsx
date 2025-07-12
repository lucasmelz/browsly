import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, X, Mic, Pause } from "lucide-react";

export const Route = createFileRoute("/live-translation")({
  component: RouteComponent,
});

// --- TYPE DEFINITIONS ---

// Google Translator API (Built-in)
// These types are based on the new Chrome Translator API documentation.
declare global {
  interface Window {
    Translator: {
      availability(options: {
        sourceLanguage: string;
        targetLanguage: string;
      }): Promise<{ state: "available" | "unavailable" | "downloading" | "downloadable" }>;

      create(options: {
        sourceLanguage: string;
        targetLanguage: string;
      }): Promise<Translator>;
    };
  }

  interface Translator {
    translate(text: string): Promise<string>;
  }
}

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

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

// App-specific types
interface Language {
  code: string; // BCP 47 language tag (e.g., "en-US")
  name: string;
  direction: "ltr" | "rtl";
}

// --- CONSTANTS ---

const languages: Language[] = [
    { code: "sq-AL", name: "Albanian", direction: "ltr" },
    { code: "ar-SA", name: "Arabic", direction: "rtl" },
    { code: "az-AZ", name: "Azerbaijani", direction: "ltr" },
    { code: "bn-BD", name: "Bengali", direction: "ltr" },
    { code: "bg-BG", name: "Bulgarian", direction: "ltr" },
    { code: "ca-ES", name: "Catalan", direction: "ltr" },
    { code: "zh-CN", name: "Chinese", direction: "ltr" },
    { code: "cs-CZ", name: "Czech", direction: "ltr" },
    { code: "da-DK", name: "Danish", direction: "ltr" },
    { code: "nl-NL", name: "Dutch", direction: "ltr" },
    { code: "en-US", name: "English", direction: "ltr" },
    { code: "nl-BE", name: "Flemish", direction: "ltr" },
    { code: "eo", name: "Esperanto", direction: "ltr" },
    { code: "et-EE", name: "Estonian", direction: "ltr" },
    { code: "fi-FI", name: "Finnish", direction: "ltr" },
    { code: "fr-FR", name: "French", direction: "ltr" },
    { code: "de-DE", name: "German", direction: "ltr" },
    { code: "el-GR", name: "Greek", direction: "ltr" },
    { code: "he-IL", name: "Hebrew", direction: "rtl" },
    { code: "hi-IN", name: "Hindi", direction: "ltr" },
    { code: "hu-HU", name: "Hungarian", direction: "ltr" },
    { code: "id-ID", name: "Indonesian", direction: "ltr" },
    { code: "ga-IE", name: "Irish", direction: "ltr" },
    { code: "it-IT", name: "Italian", direction: "ltr" },
    { code: "ja-JP", name: "Japanese", direction: "ltr" },
    { code: "ko-KR", name: "Korean", direction: "ltr" },
    { code: "lv-LV", name: "Latvian", direction: "ltr" },
    { code: "lt-LT", name: "Lithuanian", direction: "ltr" },
    { code: "ms-MY", name: "Malay", direction: "ltr" },
    { code: "fa-IR", name: "Persian", direction: "rtl" },
    { code: "pl-PL", name: "Polish", direction: "ltr" },
    { code: "pt-PT", name: "Portuguese", direction: "ltr" },
    { code: "ro-RO", name: "Romanian", direction: "ltr" },
    { code: "ru-RU", name: "Russian", direction: "ltr" },
    { code: "sk-SK", name: "Slovak", direction: "ltr" },
    { code: "sl-SI", name: "Slovenian", direction: "ltr" },
    { code: "es-ES", name: "Spanish", direction: "ltr" },
    { code: "sv-SE", name: "Swedish", direction: "ltr" },
    { code: "tl-PH", name: "Tagalog", direction: "ltr" },
    { code: "th-TH", name: "Thai", direction: "ltr" },
    { code: "tr-TR", name: "Turkish", direction: "ltr" },
    { code: "uk-UA", name: "Ukrainian", direction: "ltr" },
    { code: "ur-PK", name: "Urdu", direction: "rtl" },
];

function RouteComponent() {
  // --- STATE MANAGEMENT ---
  const [primaryLang, setPrimaryLang] = useState<Language>(languages[10]); // English
  const [secondaryLang, setSecondaryLang] = useState<Language>(languages[36]); // Spanish
  const [sourceLang, setSourceLang] = useState<Language>(languages[10]); // Initially listen to English

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [translation, setTranslation] = useState("");

  const [isListening, setIsListening] = useState(false);
  const [isTranslatorReady, setIsTranslatorReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // --- REFS ---
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const translatorRef = useRef<Translator | null>(null);

  // --- HELPER FUNCTIONS ---
  const getShortLangCode = (code: string) => code.split("-")[0];

  const clearAllText = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setTranslation("");
    setError("");
  }, []);

  // --- API INITIALIZATION & HANDLING ---

  // Check for API support on component mount
  useEffect(() => {
    const isSpeechSupported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const isTranslatorSupported = "Translator" in window;

    if (!isSpeechSupported) {
      setError("Speech Recognition API is not supported in this browser. Please try Chrome or Edge.");
    }
    if (!isTranslatorSupported) {
      setError("Google Translator API is not available. Ensure you are on a compatible Chrome version.");
    }

    if (isSpeechSupported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interim);
        if (final) {
          setTranscript((prev) => prev + final);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(`Speech recognition error: ${event.error}`);
        stopListening();
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);
  
  // Translation effect
  useEffect(() => {
    if (transcript && isTranslatorReady && translatorRef.current) {
      const performTranslation = async () => {
        try {
          const result = await translatorRef.current!.translate(transcript);
          setTranslation(result);
        } catch (e: any) {
          setError(`Translation failed: ${e.message}`);
        }
      };
      performTranslation();
    }
  }, [transcript, isTranslatorReady]);
  
  const initializeTranslator = useCallback(async (source: Language, target: Language) => {
    if (!("Translator" in window)) return;

    setIsLoading(true);
    setError("");
    setIsTranslatorReady(false);
    
    const sourceCode = getShortLangCode(source.code);
    const targetCode = getShortLangCode(target.code);

    try {
      const availability = await window.Translator.availability({
        sourceLanguage: sourceCode,
        targetLanguage: targetCode,
      });

      if (availability.state === "unavailable") {
        setError(`Translation from ${source.name} to ${target.name} is not supported.`);
        setIsLoading(false);
        return;
      }
      
      translatorRef.current = await window.Translator.create({
        sourceLanguage: sourceCode,
        targetLanguage: targetCode,
      });
      
      setIsTranslatorReady(true);
    } catch (e: any) {
      setError(`Failed to initialize translator: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- EVENT HANDLERS ---

  const handleLanguageChange = (setter: React.Dispatch<React.SetStateAction<Language>>, code: string) => {
    const newLang = languages.find(l => l.code === code);
    if (newLang) {
      if (isListening) stopListening();
      clearAllText();
      setIsTranslatorReady(false); 
      setter(newLang);

      if (sourceLang.code === (setter === setPrimaryLang ? primaryLang.code : secondaryLang.code)) {
        setSourceLang(newLang);
      }
    }
  };

  // NEW: Refactored start listening logic into a reusable helper
  const startListeningWithLang = useCallback(async (langToListen: Language) => {
      if (!recognitionRef.current) return;
  
      clearAllText();
      const targetLang = langToListen.code === primaryLang.code ? secondaryLang : primaryLang;
  
      await initializeTranslator(langToListen, targetLang);
  
      // Proceed to listen only if the translator was set up successfully
      if (translatorRef.current) {
          recognitionRef.current.lang = langToListen.code;
          recognitionRef.current.start();
          setIsListening(true);
      }
    }, [primaryLang, secondaryLang, initializeTranslator, clearAllText]
  );

  const startListening = useCallback(async () => {
    if (isListening) return;
    await startListeningWithLang(sourceLang);
  }, [isListening, sourceLang, startListeningWithLang]);

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const handleToggleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // MODIFIED: This function now handles restarting the listening session
  const handleSwitchLanguage = async () => {
    const newSourceLang = sourceLang.code === primaryLang.code ? secondaryLang : primaryLang;

    if (isListening) {
      // If we are currently listening, perform a seamless switch
      stopListening();
      
      // A short delay is crucial to allow the speech recognition engine to fully stop
      await new Promise(resolve => setTimeout(resolve, 250));

      setSourceLang(newSourceLang); // Update the state
      await startListeningWithLang(newSourceLang); // And restart with the new language
    } else {
      // If not listening, just update the source language for the next session
      setSourceLang(newSourceLang);
    }
  };
  
  // --- RENDER LOGIC ---

  const targetLang = sourceLang.code === primaryLang.code ? secondaryLang : primaryLang;

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4 font-sans">
      <h1 className="text-2xl sm:text-2xl font-bold mb-6 text-center">
        Bilingual Live Voice Translator
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 relative flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Close error">
            <X className="h-5 w-5 text-red-600" />
          </button>
        </div>
      )}

      {/* Language Selection */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
        <LanguageDropdown
          label="Language 1"
          selectedLanguage={primaryLang}
          onSelect={(code) => handleLanguageChange(setPrimaryLang, code)}
        />
        <LanguageDropdown
          label="Language 2"
          selectedLanguage={secondaryLang}
          onSelect={(code) => handleLanguageChange(setSecondaryLang, code)}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 mb-6">
        <button
          onClick={handleToggleListen}
          disabled={isLoading}
          className={`w-52 text-white font-bold py-2 px-3 rounded-full transition-all duration-300 flex items-center justify-center
            ${isListening ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
            ${isLoading ? "bg-gray-400 cursor-not-allowed" : ""}
          `}
        >

          {isLoading ? "Initializing..." : isListening ? <span className="flex gap-1 items-center"> <Pause size={22}/>Stop Listening</span> : <span className="flex gap-1 items-center"><Mic size={22}/>Listen to {sourceLang.name}</span>}
        </button>
        <button
          onClick={handleSwitchLanguage}
          // MODIFIED: The button is no longer disabled while listening
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-5 rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Switch to {sourceLang.code === primaryLang.code ? secondaryLang.name : primaryLang.name}
        </button>
      </div>
      
      {/* Status */}
       <div className="text-center mb-4 text-sm">
        Status: 
        <span className={`font-semibold ${isListening ? 'text-green-600' : ''}`}>
           {isListening ? ` Listening in ${sourceLang.name}...` : ' Idle'}
        </span>
       </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 shadow-sm bg-sidebar">
          <h3 className="font-semibold text-lg mb-2">Transcription ({sourceLang.name})</h3>
          <div className="min-h-[150px] " dir={sourceLang.direction}>
            {transcript}
            <span className="">{interimTranscript}</span>
            {!transcript && !interimTranscript && <span className="">Speech will appear here</span>}
          </div>
        </div>
        <div className="border rounded-lg p-4 shadow-sm bg-sidebar">
          <h3 className="font-semibold text-lg mb-2">Translation ({targetLang.name})</h3>
          <div className="min-h-[150px]" dir={targetLang.direction}>
            {translation || <span className="">Translation will appear here</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for the language dropdown to keep the main component cleaner
function LanguageDropdown({ label, selectedLanguage, onSelect }: { label: string, selectedLanguage: Language, onSelect: (code: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="font-semibold">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-48 border-r-8 border-transparent outline-1 outline-gray-300  hover:not-disabled:outline-[#FF7F50] hover:not-disabled:[&_svg]:stroke-[#FF7F50] focus:not-disabled:outline-[#FF7F50] focus:not-disabled:[&_svg]:stroke-[#FF7F50] data-[state=open]:outline-[#FF7F50] hover:outline-[#FF7F50] focus:outline-[#FF7F50]  data-[state=open]:[&_svg]:rotate-180 data-[state=open]:[&_svg]:stroke-[#FF7F50] [&_svg]:transition-all [&_svg]:duration-300 rounded px-2 py-1 flex justify-between items-center transition-all duration-300"
          >
            <span>{selectedLanguage.name}</span>
            <ChevronDown className="h-4 w-4 transition-transform" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onSelect={() => onSelect(lang.code)}
              className={selectedLanguage.code === lang.code ? "font-semibold bg-accent" : ""}
            >
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}