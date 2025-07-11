import {
  useState,
  forwardRef,
  useRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  type HTMLAttributes,
} from "react";

const EXAMPLE_URL =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/whisper-timestamps-demo.mp4";

interface MediaInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onTimeUpdate"> {
  onInputChange: (audio: Float32Array) => void;
  onTimeUpdate: (currentTime: number) => void;
}

interface MediaInputRef {
  setMediaTime: (time: number) => void;
}

const MediaInput = forwardRef<MediaInputRef, MediaInputProps>(
  ({ onInputChange, onTimeUpdate, ...props }, ref) => {
    // UI states
    const [dragging, setDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Create a reference to the audio and video elements
    const audioElement = useRef<HTMLAudioElement>(null);
    const videoElement = useRef<HTMLVideoElement>(null);

    const currentTimeRef = useRef<number>(0);

    useImperativeHandle(ref, () => ({
      setMediaTime(time: number) {
        if (audioElement.current?.src) {
          audioElement.current.currentTime = time;
        } else if (videoElement.current?.src) {
          videoElement.current.currentTime = time;
        }
        currentTimeRef.current = time;
      },
    }));

    const onBufferLoad = (arrayBuffer: ArrayBuffer, type: string): void => {
      const blob = new Blob([arrayBuffer.slice(0)], { type: type });
      const url = URL.createObjectURL(blob);
      processFile(arrayBuffer);

      // Create a URL for the Blob
      if (type.startsWith("audio/")) {
        // Dispose the previous source
        if (videoElement.current) {
          videoElement.current.pause();
          videoElement.current.removeAttribute("src");
          videoElement.current.load();
        }

        if (audioElement.current) {
          audioElement.current.src = url;
        }
      } else if (type.startsWith("video/")) {
        // Dispose the previous source
        if (audioElement.current) {
          audioElement.current.pause();
          audioElement.current.removeAttribute("src");
          audioElement.current.load();
        }

        if (videoElement.current) {
          videoElement.current.src = url;
        }
      } else {
        alert(`Unsupported file type: ${type}`);
      }
    };

    const readFile = (file: File | null): void => {
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const result = e.target?.result;
        if (result instanceof ArrayBuffer) {
          onBufferLoad(result, file.type);
        }
      };
      reader.readAsArrayBuffer(file);
    };

    const handleInputChange = (
      event: React.ChangeEvent<HTMLInputElement>
    ): void => {
      const file = event.target.files?.[0] || null;
      readFile(file);
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0] || null;
      readFile(file);
    };

    const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === "VIDEO" || target.tagName === "AUDIO") {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (target.tagName === "INPUT") {
        e.stopPropagation();
      } else {
        fileInputRef.current?.click();
        e.stopPropagation();
      }
    };

    const processFile = async (buffer: ArrayBuffer): Promise<void> => {
      const audioContext = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)({ sampleRate: 16_000 });

      try {
        const audioBuffer = await audioContext.decodeAudioData(buffer);
        let audio: Float32Array;
        if (audioBuffer.numberOfChannels === 2) {
          // Merge channels
          const SCALING_FACTOR = Math.sqrt(2);
          const left = audioBuffer.getChannelData(0);
          const right = audioBuffer.getChannelData(1);
          audio = new Float32Array(left.length);
          for (let i = 0; i < audioBuffer.length; ++i) {
            audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
          }
        } else {
          audio = audioBuffer.getChannelData(0);
        }
        onInputChange(audio);
      } catch (e) {
        alert(e);
      }
    };

    const requestRef = useRef<number | null>(null);

    const updateTime = useCallback((): void => {
      let elem: HTMLAudioElement | HTMLVideoElement | null = null;
      if (audioElement.current?.src) {
        elem = audioElement.current;
      } else if (videoElement.current?.src) {
        elem = videoElement.current;
      }

      if (elem && currentTimeRef.current !== elem.currentTime) {
        currentTimeRef.current = elem.currentTime;
        onTimeUpdate(elem.currentTime);
      }

      // Request the next frame
      requestRef.current = requestAnimationFrame(updateTime);
    }, [onTimeUpdate]);

    useEffect(() => {
      // Start the animation
      requestRef.current = requestAnimationFrame(updateTime);

      return () => {
        // Cleanup on component unmount
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
      };
    }, [updateTime]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDragEnter = (_e: React.DragEvent<HTMLDivElement>): void => {
      setDragging(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>): void => {
      setDragging(false);
    };

    const handleExampleClick = async (
      e: React.MouseEvent<HTMLSpanElement>
    ): Promise<void> => {
      e.stopPropagation();
      try {
        const buffer = await fetch(EXAMPLE_URL).then((r) => r.arrayBuffer());
        if (videoElement.current) {
          videoElement.current.src = URL.createObjectURL(
            new Blob([buffer], { type: "video/mp4" })
          );
        }
        onBufferLoad(buffer, "video/mp4");
      } catch (error) {
        console.error("Failed to load example video:", error);
      }
    };

    return (
      <div
        {...props}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept="audio/*,video/*"
          onChange={handleInputChange}
          ref={fileInputRef}
          className="hidden"
        />
        <audio
          ref={audioElement}
          controls
          style={{ display: audioElement.current?.src ? "block" : "none" }}
          className="w-full max-h-full"
        />
        <video
          ref={videoElement}
          controls
          style={{ display: videoElement.current?.src ? "block" : "none" }}
          className="w-full max-h-full"
        />
        {!audioElement.current?.src && !videoElement.current?.src && (
          <div
            className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-md h-[250px]"
            style={{ borderColor: dragging ? "blue" : "lightgray" }}
          >
            <span className="text-gray-600 text-center">
              <u>Drag & drop</u> or <u>click</u>
              <br />
              to select media
            </span>
            <span
              className="text-gray-500 text-sm hover:text-gray-800 dark:hover:text-gray-300 mt-2"
              onClick={handleExampleClick}
            >
              (or <u>try an example</u>)
            </span>
          </div>
        )}
      </div>
    );
  }
);

MediaInput.displayName = "MediaInput";

export default MediaInput;
