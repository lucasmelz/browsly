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
import { ChevronDown, FileText } from "lucide-react";
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

const CHUNK_SIZE = 11640; // Maximum characters per chunk

function RouteComponent() {
  const [extractedText, setExtractedText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
  }>({ current: 0, total: 0 });
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

  function splitTextIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < text.length) {
      let endIndex = currentIndex + CHUNK_SIZE;
      
      // If we're not at the end of the text, try to find a good breaking point
      if (endIndex < text.length) {
        // Look for sentence endings within the last 200 characters of the chunk
        const searchStart = Math.max(endIndex - 200, currentIndex);
        const chunkText = text.substring(searchStart, endIndex);
        const sentenceEndings = /[.!?]\s+/g;
        let lastMatch;
        let match;
        
        while ((match = sentenceEndings.exec(chunkText)) !== null) {
          lastMatch = match;
        }
        
        if (lastMatch) {
          endIndex = searchStart + lastMatch.index + lastMatch[0].length;
        }
      }
      
      chunks.push(text.substring(currentIndex, endIndex).trim());
      currentIndex = endIndex;
    }

    console.log(chunks);

    return chunks.filter(chunk => chunk.length > 0);
  }


  async function summarizeChunk(
    chunk: string, 
    chunkIndex: number, 
    totalChunks: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summarizer: any
  ): Promise<string> {
    const contextText = totalChunks > 1 
      ? `This is part ${chunkIndex + 1} of ${totalChunks} from a PDF document.`
      : "This is content extracted from a PDF document.";
  
    const TIMEOUT_MS = 60000; // 60 seconds timeout
  
    try {
      // Create a timeout promise that rejects after the specified time
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout: Chunk ${chunkIndex + 1} summarization exceeded ${TIMEOUT_MS / 1000} seconds`));
        }, TIMEOUT_MS);
      });
  
      // Create the summarization promise
      const summarizationPromise = (async () => {
        const stream = summarizer.summarizeStreaming(chunk, {
          context: contextText,
        });
  
        let chunkSummary = "";
        for await (const streamChunk of stream) {
          chunkSummary += streamChunk;
        }
        
        return chunkSummary;
      })();
  
      // Race between timeout and summarization
      const result = await Promise.race([
        summarizationPromise,
        timeoutPromise
      ]);
  
      return result;
  
    } catch (err) {
      console.error(`Error summarizing chunk ${chunkIndex + 1}:`, err);
      
      // Check if it's a timeout error
      if (err instanceof Error && err.message.includes('Timeout')) {
        console.warn(`Chunk ${chunkIndex + 1} timed out, skipping...`);
        // Return a placeholder or attempt a fallback summary
        return `[Chunk ${chunkIndex + 1} could not be summarized due to timeout - content may contain complex data or formatting that caused processing issues]`;
      }
      
      throw new Error(`Failed to summarize chunk ${chunkIndex + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function combineChunkSummaries(chunkSummaries: string[]): Promise<string> {
    if (chunkSummaries.length === 1) {
      return chunkSummaries[0];
    }

    // Create a final summarizer to combine all chunk summaries
    const options = {
      type: summaryType,
      format: summaryFormat,
      length: summaryLength,
    };

    try {
      // @ts-expect-error - Summarizer API is experimental
      const finalSummarizer = await Summarizer.create(options);
      
      const combinedText = chunkSummaries.join("\n\n---\n\n");
      const contextText = `These are summaries from different sections of the same PDF document. Please create a cohesive ${summaryType} summary that combines the key information from all sections.`;
      
      const stream = finalSummarizer.summarizeStreaming(combinedText, {
        context: contextText,
      });

      let finalSummary = "";
      for await (const chunk of stream) {
        finalSummary += chunk;
      }

      return finalSummary;
    } catch (err) {
      console.error("Error combining summaries:", err);
      // Fallback: return concatenated summaries with headers
      return chunkSummaries
        .map((summary, index) => `**Chunk ${index + 1}:**\n${summary}`)
        .join("\n\n");
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
    setProcessingProgress({ current: 0, total: 0 });

    try {
      // Split text into chunks
      const chunks = splitTextIntoChunks(extractedText);
      console.log(`Split text into ${chunks.length} chunks`);
      
      setProcessingProgress({ current: 0, total: chunks.length });

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

      // Summarize each chunk
      const chunkSummaries: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        setProcessingProgress({ current: i + 1, total: chunks.length });
        
        const chunkSummary = await summarizeChunk(chunks[i], i, chunks.length, summarizer);
        chunkSummaries.push(chunkSummary);
        
        // Update UI with progress
        if (chunks.length === 1) {
          setSummary(chunkSummary);
        } else {
          // Show intermediate progress for multiple chunks
          const progressSummary = chunkSummaries
            .map((summary, index) => `**Chunk ${index + 1}:**\n${summary}`)
            .join("\n\n---\n\n");
          setSummary(progressSummary + "\n\n*Processing remaining chunks...*");
        }
      }

      // If we have multiple chunks, combine their summaries and append
      if (chunks.length > 1) {
        // Show all section summaries first
        const sectionSummaries = chunkSummaries
          .map((summary, index) => `**Chunk ${index + 1}:**\n${summary}`)
          .join("\n\n---\n\n");
        
        setSummary(sectionSummaries + "\n\n*Creating final combined summary...*");
        
        const finalSummary = await combineChunkSummaries(chunkSummaries);
        
        // Append the final summary at the end
        setSummary(
          sectionSummaries + 
          "\n\n" + 
          "=".repeat(50) + 
          "\n\n**FINAL SUMMARY:**\n\n" + 
          finalSummary
        );
      }

    } catch (err) {
      console.error("Summarization error:", err);
      if (err instanceof Error) {
        setError(`Failed to summarize the text: ${err.message}`);
      } else {
        setError("Failed to summarize the text. Please try again.");
      }
    } finally {
      setIsLoading(false);
      setDownloadProgress(0);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }

  const chunks = extractedText ? splitTextIntoChunks(extractedText) : [];

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
          <div className="mt-2 space-y-1">
            <p className="text-sm text-green-600">
              ✓ Text extracted successfully ({extractedText.length} characters)
            </p>
            {chunks.length > 1 && (
              <p className="text-sm flex items-center gap-1">
                <FileText size={14}/> Will be processed in {chunks.length} chunks for better performance
              </p>
            )}
          </div>
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

      {/* Processing Progress */}
      {processingProgress.total > 0 && isLoading && (
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-700 mb-2">
            Processing chunks: {processingProgress.current} of {processingProgress.total}
          </p>
          <div className="w-full bg-green-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(processingProgress.current / processingProgress.total) * 100}%` 
              }}
            ></div>
          </div>
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
            className="w-full bg-white text-black dark:bg-sidebar dark:text-white min-h-[300px]"
            placeholder="Your summary will appear here..."
          />
          <p className="text-sm mt-2 w-full text-center">
            You can edit the summary above before copying it.
          </p>
        </div>
      )}

      {/* Extracted Text Preview (Optional) */}
      {extractedText && (
        <details className="border rounded-lg p-4 shadow-sm bg-sidebar">
          <summary className="cursor-pointer font-medium">
            <span className="ml-2">
              View Extracted Text ({extractedText.length} characters
              {chunks.length > 1 && `, ${chunks.length} chunks`})
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