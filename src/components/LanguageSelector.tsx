import { titleCase } from "@/utils/title-case";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

// List of supported languages:
// https://help.openai.com/en/articles/7031512-whisper-api-faq
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
const LANGUAGES: Record<string, string> = {
  af: "afrikaans",
  sq: "albanian",
  am: "amharic",
  ar: "arabic",
  hy: "armenian",
  as: "assamese",
  az: "azerbaijani",
  ba: "bashkir",
  eu: "basque",
  be: "belarusian",
  bn: "bengali",
  bs: "bosnian",
  br: "breton",
  bg: "bulgarian",
  ca: "catalan/valencian",
  zh: "chinese",
  hr: "croatian",
  cs: "czech",
  da: "danish",
  nl: "dutch/flemish",
  en: "english",
  et: "estonian",
  fo: "faroese",
  fi: "finnish",
  fr: "french",
  gl: "galician",
  ka: "georgian",
  de: "german",
  el: "greek",
  gu: "gujarati",
  ht: "haitian creole/haitian",
  ha: "hausa",
  haw: "hawaiian",
  he: "hebrew",
  hi: "hindi",
  hu: "hungarian",
  is: "icelandic",
  id: "indonesian",
  it: "italian",
  ja: "japanese",
  jw: "javanese",
  kn: "kannada",
  kk: "kazakh",
  km: "khmer",
  ko: "korean",
  lo: "lao",
  la: "latin",
  lv: "latvian",
  ln: "lingala",
  lt: "lithuanian",
  lb: "luxembourgish/letzeburgesch",
  mk: "macedonian",
  mg: "malagasy",
  ms: "malay",
  ml: "malayalam",
  mt: "maltese",
  mi: "maori",
  mr: "marathi",
  mn: "mongolian",
  my: "myanmar/burmese",
  ne: "nepali",
  no: "norwegian",
  nn: "nynorsk",
  oc: "occitan",
  ps: "pashto/pushto",
  fa: "persian",
  pl: "polish",
  pt: "portuguese",
  pa: "punjabi/panjabi",
  ro: "romanian/moldavian/moldovan",
  ru: "russian",
  sa: "sanskrit",
  sr: "serbian",
  sn: "shona",
  sd: "sindhi",
  si: "sinhala/sinhalese",
  sk: "slovak",
  sl: "slovenian",
  so: "somali",
  es: "spanish/castilian",
  su: "sundanese",
  sw: "swahili",
  sv: "swedish",
  tl: "tagalog",
  tg: "tajik",
  ta: "tamil",
  tt: "tatar",
  te: "telugu",
  th: "thai",
  bo: "tibetan",
  tr: "turkish",
  tk: "turkmen",
  uk: "ukrainian",
  ur: "urdu",
  uz: "uzbek",
  vi: "vietnamese",
  cy: "welsh",
  yi: "yiddish",
  yo: "yoruba",
};

type Props = {
  language: keyof typeof LANGUAGES;
  setLanguage: (language: string) => void;
};

const LanguageSelector = ({ language, setLanguage }: Props) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-42 outline p-[6px] rounded-md hover:outline-[#FF7F50] hover:[&_svg]:stroke-[#FF7F50] focus:outline-[#FF7F50] focus:[&_svg]:stroke-[#FF7F50] data-[state=open]:outline-[#FF7F50] appearance-none transition-colors text-sm font-medium duration-300 flex justify-between items-center data-[state=open]:[&_svg]:rotate-180 data-[state=open]:[&_svg]:stroke-[#FF7F50] [&_svg]:transition-all [&_svg]:duration-300"
          aria-label="Select language"
          type="button"
        >
          <span className="flex w-full items-center justify-between">
            {titleCase(LANGUAGES[language])}
            <ChevronDown
              size={15}
              className="transition-transform duration-200"
            />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full min-w-[180px]">
        {Object.keys(LANGUAGES).map((key) => (
          <DropdownMenuItem
            key={key}
            onSelect={() => setLanguage(key)}
            className={key === language ? "font-semibold bg-accent" : ""}
          >
            {titleCase(LANGUAGES[key])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>

    //   <select {...props} value={language} onChange={handleLanguageChange}>
    //     {Object.keys(LANGUAGES).map((key, i) => (
    //       <option key={key} value={key}>
    //         {names[i]}
    //       </option>
    //     ))}
    //   </select>
  );
};

export { LanguageSelector };
