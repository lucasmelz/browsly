import { RequirementsTooltip } from "@/components/RequirementsTooltip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import pdfToText from "react-pdftotext";

export const Route = createFileRoute("/summarize-pdf")({
  component: RouteComponent,
});

type SummaryType = "key-points" | "tldr" | "teaser" | "headline";
type SummaryLength = "short" | "medium" | "long";
type SummaryFormat = "markdown" | "plain-text";

const requirements = [
  {
    type: "Browser",
    description: "Google Chrome 138 or later.",
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
  const [extractedText, setExtractedText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [error, setError] = useState<string>("");

  // Summary options
  const [summaryType, setSummaryType] = useState<SummaryType>("key-points");
  const [summaryLength, setSummaryLength] = useState<SummaryLength>("medium");
  const [summaryFormat, setSummaryFormat] = useState<SummaryFormat>("markdown");

  function extractText(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) {
      const file = event.target.files[0];
      setError("");
      pdfToText(file)
        .then((text) => {
          console.log(text);
          setExtractedText(text);
        })
        .catch(() => {
          console.error("Failed to extract text from pdf");
          setError("Failed to extract text from PDF. Please try again.");
        });
    }
  }

  async function checkSummarizerSupport(): Promise<boolean> {
    if (!("Summarizer" in self)) {
      setError(
        "Summarizer API is not supported in this browser. Please use Chrome 138 or later."
      );
      return false;
    }

    try {
      // @ts-expect-error - Summarizer API is experimental
      const availability = await Summarizer.availability();

      if (availability === "unavailable") {
        setError(
          "Summarizer API is not available. Please check if your system meets the requirements."
        );
        return false;
      }

      return true;
    } catch {
      setError("Error checking Summarizer API availability.");
      return false;
    }
  }

  async function summarizeText() {
    if (!extractedText.trim()) {
      setError("Please upload and extract text from a PDF first.");
      return;
    }

    const isSupported = await checkSummarizerSupport();
    if (!isSupported) return;

    setIsLoading(true);
    setError("");
    setSummary("");
    setDownloadProgress(0);

    try {
      const options = {
        type: summaryType,
        format: summaryFormat,
        length: summaryLength,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        monitor(m: any) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          m.addEventListener("downloadprogress", (e: any) => {
            const progress = Math.round(e.loaded * 100);
            setDownloadProgress(progress);
            console.log(`Downloaded ${progress}%`);
          });
        },
      };

      // @ts-expect-error - Summarizer API is experimental
      const summarizer = await Summarizer.create(options);

      // Use streaming for better UX with large texts
      const stream = summarizer.summarizeStreaming(extractedText, {
        context: "This is content extracted from a PDF document.",
      });

      let accumulatedSummary = "";
      for await (const chunk of stream) {
        accumulatedSummary += chunk;
        setSummary(accumulatedSummary);
      }
    } catch (err) {
      console.error("Summarization error:", err);
      setError("Failed to summarize the text. Please try again.");
    } finally {
      setIsLoading(false);
      setDownloadProgress(0);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center flex justify-center items-center flex-col gap-2 mb-8">
        <h1 className="text-2xl font-bold">PDF Summarizer</h1>
        <RequirementsTooltip requirements={requirements} />
      </div>

      {/* File Upload */}
      <div className="border rounded-lg p-4 shadow-sm bg-sidebar">
        <h2 className="text-xl font-semibold mb-4">1. Upload PDF</h2>
        <input
          type="file"
          accept="application/pdf"
          onChange={extractText}
          className="block w-full text-sm transition-all outline-none aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive file:mr-4 file:h-9 file:px-4 file:py-2 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground file:shadow-xs hover:file:bg-primary/90 file:transition-all file:inline-flex file:items-center file:justify-center file:gap-2 file:whitespace-nowrap disabled:pointer-events-none disabled:opacity-50"
        />
        {extractedText && (
          <p className="mt-2 text-sm text-green-600">
            ✓ Text extracted successfully ({extractedText.length} characters)
          </p>
        )}
      </div>

      {/* Summary Options */}
      <div className="border rounded-lg p-4 shadow-sm bg-sidebar">
        <h2 className="text-xl font-semibold mb-4">2. Summary Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Summary Type */}
          <div>
            <Label className="block text-sm font-medium mb-2">
              Summary Type
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {summaryType === "key-points"
                    ? "Key Points"
                    : summaryType === "tldr"
                      ? "TL;DR"
                      : summaryType === "teaser"
                        ? "Teaser"
                        : "Headline"}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setSummaryType("key-points")}>
                  Key Points
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSummaryType("tldr")}>
                  TL;DR
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSummaryType("teaser")}>
                  Teaser
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSummaryType("headline")}>
                  Headline
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Summary Length */}
          <div>
            <Label className="block text-sm font-medium mb-2">Length</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {summaryLength === "short"
                    ? "Short"
                    : summaryLength === "medium"
                      ? "Medium"
                      : "Long"}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem onSelect={() => setSummaryLength("short")}>
                  Short
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSummaryLength("medium")}>
                  Medium
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSummaryLength("long")}>
                  Long
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Summary Format */}
          <div>
            <Label className="block text-sm font-medium mb-2">Format</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {summaryFormat === "markdown" ? "Markdown" : "Plain Text"}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                <DropdownMenuItem onSelect={() => setSummaryFormat("markdown")}>
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setSummaryFormat("plain-text")}
                >
                  Plain Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Summarize Button */}
      <div className="text-center">
        <Button
          onClick={summarizeText}
          disabled={!extractedText || isLoading}
          // className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Summarizing..." : "Generate Summary"}
        </Button>
      </div>

      {/* Download Progress */}
      {downloadProgress > 0 && downloadProgress < 100 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-700 mb-2">Downloading AI model...</p>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-600 mt-1">{downloadProgress}%</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Output */}
      {summary && (
        <div className="border rounded-lg p-4 shadow-sm bg-sidebar">
          <h2 className="text-xl font-semibold mb-4">3. Generated Summary</h2>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full bg-white text-black dark:bg-sidebar dark:text-white"
            // className="w-full h-64 p-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Your summary will appear here..."
          />
          <p className="text-sm mt-2 w-full text-center">
            You can edit the summary above before copying or saving it.
          </p>
        </div>
      )}

      {/* Extracted Text Preview (Optional) */}
      {extractedText && (
        <details className="border rounded-lg p-4 shadow-sm bg-sidebar">
          <summary className="cursor-pointer font-medium">
            <span className="ml-2">
              View Extracted Text ({extractedText.length} characters)
            </span>
          </summary>
          <div className="mt-4 max-h-40 overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap">{extractedText}</pre>
          </div>
        </details>
      )}
    </div>
  );
}
