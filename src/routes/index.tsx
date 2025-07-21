import { createFileRoute } from "@tanstack/react-router";
import {
  MicVocalIcon,
  ScrollText,
  ShieldCheck,
  SpeechIcon,
  SquareChartGanttIcon,
  Subtitles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const features = [
  {
    icon: <SquareChartGanttIcon className="h-12 w-12 text-blue-500" />,
    title: "Live Voice Translation",
    description:
      "Experience seamless, real-time voice translation between multiple languages, powered by the browser's native capabilities.",
  },
  {
    icon: <MicVocalIcon className="h-12 w-12 text-green-500" />,
    title: "Speech to Text & Summarization",
    description:
      "Transcribe your voice into text and get a concise summary of the content, all within your browser.",
  },
  {
    icon: <SpeechIcon className="h-12 w-12 text-yellow-500" />,
    title: "Text to Speech",
    description:
      "Convert any text into natural-sounding speech using either the browser's built-in voice or an advanced AI model.",
  },
  {
    icon: <ScrollText className="h-12 w-12 text-purple-500" />,
    title: "Audio Transcription",
    description:
      "Upload an audio file or record your voice to get a complete and accurate transcription.",
  },
  {
    icon: <Subtitles className="h-12 w-12 text-red-500" />,
    title: "Generate Captions",
    description:
      "Create SRT-formatted subtitles for your videos and audio files, with support for translation.",
  },
];

function Index() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">Welcome to Browsly</h1>
        <p className="text-xl text-muted-foreground">
          Leveraging the power of your browser for cutting-edge AI features.
        </p>
      </header>

      <section className="mb-12">
        <div className="flex items-center justify-center p-6 rounded-lg">
          <div className="text-center">
            <h2 className="text-3xl font-semibold mb-4">What is Browlsy?</h2>
            <p className="text-lg leading-relaxed">
              Browlsy is a web application that brings the power of modern AI
              directly to your browser. We use native browser APIs and
              cutting-edge libraries like Transformers.js to provide a suite of
              powerful tools without compromising your privacy.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <div className="flex items-center justify-center p-6 rounded-lg">
          <div className="text-center">
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-semibold mb-4">
              Your Privacy, Our Priority
            </h2>
            <p className="text-lg leading-relaxed">
              Everything runs entirely within your browser. No data is ever sent
              to a server, ensuring your activities remain private and secure.
              Your information stays on your device, always.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-semibold text-center mb-8">
          Our Features
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg flex flex-col items-center text-center"
            >
              {feature.icon}
              <h3 className="text-2xl font-semibold my-4">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center mt-2">
        <p className="text-muted-foreground">
          <a
            href="https://buymeacoffee.com/lucaswmelz"
            className="flex items-center justify-center gap-2 hover:scale-105 transition-transform duration-300"
          >
            Support this project: buy me a coffee.
            <img
              src="buymeacoffee.png"
              alt="Buy me a coffee"
              className="h-10 rounded-2xl"
            />
          </a>
        </p>
      </footer>
    </div>
  );
}
