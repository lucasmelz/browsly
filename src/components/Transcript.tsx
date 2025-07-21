import { useMemo, type HTMLAttributes } from "react";
import { Button } from "./ui/button";
import { Download } from "lucide-react";

interface ChunkData {
  text: string;
  timestamp: [number, number];
}

interface TranscriptData {
  chunks: ChunkData[];
}

interface ChunkProps extends HTMLAttributes<HTMLSpanElement> {
  chunk: ChunkData;
  currentTime: number;
  onClick: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

const Chunk = ({ chunk, currentTime, onClick, ...props }: ChunkProps) => {
  const { text, timestamp } = chunk;
  const [start, end] = timestamp;
  const bolded = start <= currentTime && currentTime < end;

  return (
    <span {...props}>
      {text.startsWith(" ") ? " " : ""}
      <span
        onClick={onClick}
        className="text-md text-gray-600 dark:text-gray-300 cursor-pointer hover:text-red-600"
        title={timestamp
          .filter(Boolean)
          .map((x) => x.toFixed(2))
          .join(" → ")}
        style={{
          textDecoration: bolded ? "underline" : "none",
          textShadow: bolded ? "0 0 1px #000" : "none",
        }}
      >
        {text.trim()}
      </span>
    </span>
  );
};

interface TranscriptProps extends HTMLAttributes<HTMLDivElement> {
  transcript: TranscriptData;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  handleDownloadSRT: () => void;
}

const Transcript = ({
  transcript,
  currentTime,
  setCurrentTime,
  handleDownloadSRT,
  ...props
}: TranscriptProps) => {
  const jsonTranscript = useMemo(() => {
    return (
      JSON.stringify(transcript, null, 2)
        // post-process the JSON to make it more readable
        .replace(/( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm, "$1[$2 $3]")
    );
  }, [transcript]);

  const downloadTranscript = (): void => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleChunkClick = (chunk: ChunkData) => (): void => {
    setCurrentTime(chunk.timestamp[0]); // Set to start of chunk
  };

  return (
    <>
      <div {...props}>
        {transcript.chunks.map((chunk, i) => (
          <Chunk
            key={i}
            chunk={chunk}
            currentTime={currentTime}
            onClick={handleChunkClick(chunk)}
          />
        ))}
      </div>
      <div className="flex justify-center gap-2 border-t text-sm max-h-[150px] overflow-y-auto p-2 scrollbar-thin">
        <Button
          onClick={handleDownloadSRT}
          className="bg-green-500 text-white hover:bg-green-600 flex items-center gap-2 px-4 py-2"
        >
          <Download size={16} />
          Download SRT
        </Button>

        <Button
          onClick={downloadTranscript}
          className="bg-green-500 text-white hover:bg-green-600 flex items-center gap-2 px-4 py-2"
        >
          <Download size={16} />
          Download Transcript (JSON)
        </Button>
      </div>
    </>
  );
};

export default Transcript;
