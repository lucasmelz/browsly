// Utility functions for SRT conversion and download

/**
 * Converts seconds to SRT timestamp format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} - Formatted timestamp
 */
function formatSRTTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

type Chunk = {
  text: string;
  timestamp: number[];
};

/**
 * Converts transcript chunks to SRT format
 * @param {Chunk[]} chunks - Array of transcript chunks with text and timestamp
 * @returns {string} - SRT formatted string
 */
export function convertToSRT(chunks: Chunk[]) {
  if (!chunks || !Array.isArray(chunks)) {
    return "";
  }

  let srtContent = "";
  let subtitleIndex = 1;

  for (const chunk of chunks) {
    if (!chunk.text || !chunk.timestamp || chunk.timestamp.length !== 2) {
      continue; // Skip invalid chunks
    }

    const [startTime, endTime] = chunk.timestamp;
    const startTimestamp = formatSRTTimestamp(startTime);
    const endTimestamp = formatSRTTimestamp(endTime);

    // Add subtitle entry
    srtContent += `${subtitleIndex}\n`;
    srtContent += `${startTimestamp} --> ${endTimestamp}\n`;
    srtContent += `${chunk.text.trim()}\n\n`;

    subtitleIndex++;
  }

  return srtContent.trim();
}

/**
 * Downloads content as a file
 * @param {string} content - File content
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 */
export function downloadFile(content: string, filename: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

type Result = {
    text: string;
    chunks: Chunk[];
    sourceLanguage: string;
    targetLanguage: string;
    task: 'translate' | 'transcribe';
}

/**
 * Downloads transcript as SRT file
 * @param {Result} result - Transcript result object with chunks
 * @param {string} baseFilename - Base filename (without extension)
 */
export function downloadSRT(result: Result, baseFilename = "subtitles") {
  if (!result || !result.chunks) {
    console.error("Invalid result object for SRT download");
    return;
  }

  const srtContent = convertToSRT(result.chunks);

  if (!srtContent) {
    console.error("No valid content to convert to SRT");
    return;
  }

  // Create filename with task info
  const taskSuffix =
    result.task === "translate"
      ? `_${result.sourceLanguage}-to-${result.targetLanguage}`
      : `_${result.sourceLanguage}`;

  const filename = `${baseFilename}${taskSuffix}.srt`;

  downloadFile(srtContent, filename, "text/srt");
}
