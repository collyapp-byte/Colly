"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle, Mic } from "lucide-react";

type MicState = "idle" | "requesting" | "recording" | "transcribing" | "error";

/**
 * Picks the first audio container the browser can actually record. iOS Safari
 * does not support "audio/webm", so a hard-coded webm mimeType throws there;
 * "audio/mp4" (AAC) is its native format. Returns "" when MediaRecorder is
 * missing or none of the candidates are supported, so the caller can omit the
 * option and let the browser choose its default.
 */
function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** File extension to send for a detected mimeType (server reads the blob type). */
function extensionForMimeType(mimeType: string): string {
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  if (mimeType.startsWith("audio/aac")) return "aac";
  if (mimeType.startsWith("audio/mpeg")) return "mp3";
  return "webm";
}

type VoiceInputProps = {
  /** Called with the transcribed text once recording finishes. */
  onTranscript: (transcript: string) => void;
  label?: string;
  className?: string;
};

/**
 * Reusable voice dictation control. Records from the microphone, sends the
 * audio to the transcription endpoint, and hands the text back to the caller.
 * Dropping it next to any textarea is enough; it owns all recording state.
 */
export function VoiceInput({
  onTranscript,
  label = "Record",
  className = "",
}: VoiceInputProps) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  function clearErrorTimer() {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }

  function stopTracks() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function showError(message: string) {
    if (!mountedRef.current) return;
    setError(message);
    setState("error");
    errorTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setState("idle");
      setError(null);
    }, 6000);
  }

  async function startRecording() {
    clearErrorTimer();
    setError(null);

    // Early guards so the user gets a reason instead of a silent failure.
    if (!window.isSecureContext) {
      showError("Microphone needs HTTPS. Access this site over https://");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showError("This browser does not support voice recording.");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stopTracks();
        const blob = new Blob(audioChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        if (blob.size === 0) {
          if (mountedRef.current) setState("idle");
          return;
        }

        if (mountedRef.current) setState("transcribing");
        try {
          const formData = new FormData();
          formData.append(
            "audio",
            blob,
            `voice-note.${extensionForMimeType(mimeType)}`,
          );
          const res = await fetch("/api/voice/transcribe-description", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            throw new Error("Transcription failed");
          }
          const data: { transcript: string } = await res.json();
          const transcript = data.transcript.trim();
          if (mountedRef.current) {
            if (transcript) onTranscriptRef.current(transcript);
            setState("idle");
          }
        } catch {
          showError("Could not transcribe the recording. Try again.");
        }
      };

      recorder.start(100);
      setState("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        showError(
          "Microphone permission denied. Enable it in your browser settings.",
        );
      } else if (msg.includes("NotFound")) {
        showError("No microphone found on this device.");
      } else if (!window.isSecureContext) {
        showError(
          "Microphone needs HTTPS. Open this site over https:// not http://",
        );
      } else {
        showError("Could not access microphone. Try again.");
      }
    }
  }

  function handleClick() {
    if (state === "idle") {
      void startRecording();
    } else if (state === "recording") {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } else if (state === "error") {
      clearErrorTimer();
      setError(null);
      setState("idle");
    }
  }

  // Cleanup on unmount: stop any live microphone and pending timers.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearErrorTimer();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      stopTracks();
    };
  }, []);

  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={state === "requesting" || state === "transcribing"}
        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-[13px] select-none transition-colors focus:outline-none focus:ring-2 focus:ring-colly/20 ${
          state === "idle"
            ? "cursor-pointer text-gray-500 hover:text-gray-700"
            : state === "recording"
              ? "cursor-pointer text-red-500"
              : "cursor-not-allowed text-gray-500"
        }`}
        aria-label={
          state === "idle"
            ? "Start voice input"
            : state === "recording"
              ? "Stop recording"
              : state === "error"
                ? "Try again"
                : undefined
        }
        title={
          state === "idle"
            ? "Voice input"
            : state === "recording"
              ? "Recording… tap to stop"
              : state === "error"
                ? "Click to try again"
                : undefined
        }
      >
        {state === "idle" && (
          <>
            <Mic className="h-4 w-4" aria-hidden />
            <span>{label}</span>
          </>
        )}
        {state === "requesting" && (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            <span>Connecting…</span>
          </>
        )}
        {state === "recording" && (
          <>
            <span
              className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500"
              aria-hidden
            />
            <span className="animate-pulse">Recording… tap to stop</span>
          </>
        )}
        {state === "transcribing" && (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            <span>Transcribing…</span>
          </>
        )}
        {state === "error" && (
          <>
            <AlertCircle className="h-4 w-4" aria-hidden />
            <span>Try again</span>
          </>
        )}
      </button>
      {state === "error" && error && (
        <p className="mb-1.5 flex items-start gap-1.5 text-[13px] text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
