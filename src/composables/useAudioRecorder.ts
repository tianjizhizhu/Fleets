import { ref, onUnmounted } from 'vue';
import type { RecordingState } from '@/types';

const speechRecognition = ref<any>(null);
const isSupported = ref(false);

if (typeof window !== 'undefined') {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SpeechRecognition) {
    isSupported.value = true;
    speechRecognition.value = new SpeechRecognition();
    speechRecognition.value.continuous = true;
    speechRecognition.value.interimResults = true;
    speechRecognition.value.lang = 'zh-CN';
  }
}

export function useSpeechRecognition() {
  const transcript = ref('');
  const isRecognizing = ref(false);
  const error = ref<string | null>(null);

  function startRecognition() {
    if (!speechRecognition.value || isRecognizing.value) return;

    transcript.value = '';
    error.value = null;

    speechRecognition.value.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      transcript.value = finalTranscript || interimTranscript;
    };

    speechRecognition.value.onerror = (event: any) => {
      error.value = event.error;
      isRecognizing.value = false;
    };

    speechRecognition.value.onend = () => {
      isRecognizing.value = false;
    };

    try {
      speechRecognition.value.start();
      isRecognizing.value = true;
    } catch (e) {
      error.value = 'Failed to start recognition';
    }
  }

  function stopRecognition(): string {
    if (!speechRecognition.value) return transcript.value;

    try {
      speechRecognition.value.stop();
    } catch (e) {
    }

    isRecognizing.value = false;
    return transcript.value;
  }

  function abortRecognition() {
    if (!speechRecognition.value) return;

    try {
      speechRecognition.value.abort();
    } catch (e) {
    }

    isRecognizing.value = false;
    transcript.value = '';
  }

  return {
    transcript,
    isRecognizing,
    error,
    isSupported,
    startRecognition,
    stopRecognition,
    abortRecognition
  };
}

export function useAudioRecorder() {
  const state = ref<RecordingState>({
    isRecording: false,
    duration: 0,
    audioLevel: 0,
    transcript: '',
    status: 'idle'
  });

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let timer: number | null = null;
  let analyser: AnalyserNode | null = null;
  let audioContext: AudioContext | null = null;

  const { transcript, isRecognizing, startRecognition, stopRecognition, abortRecognition } = useSpeechRecognition();

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start(100);

      state.value = {
        isRecording: true,
        duration: 0,
        audioLevel: 0,
        transcript: '',
        status: 'recording'
      };

      startRecognition();

      timer = window.setInterval(() => {
        state.value.duration++;

        if (analyser) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          state.value.audioLevel = Math.min(average / 128, 1);
        }
      }, 1000);

    } catch (e) {
      state.value.status = 'error';
      state.value = {
        ...state.value,
        status: 'error'
      };
    }
  }

  async function stopRecording(): Promise<{ audioBlob: Blob | null; transcript: string }> {
    return new Promise((resolve) => {
      if (!mediaRecorder) {
        resolve({ audioBlob: null, transcript: transcript.value });
        return;
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const finalTranscript = stopRecognition();

        state.value = {
          ...state.value,
          isRecording: false,
          status: 'processing'
        };

        if (timer) {
          clearInterval(timer);
          timer = null;
        }

        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }

        if (analyser) {
          analyser = null;
        }

        resolve({
          audioBlob,
          transcript: finalTranscript || transcript.value
        });
      };

      try {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (e) {
      }
    });
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    abortRecognition();

    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    state.value = {
      isRecording: false,
      duration: 0,
      audioLevel: 0,
      transcript: '',
      status: 'idle'
    };
  }

  function resetState() {
    state.value = {
      isRecording: false,
      duration: 0,
      audioLevel: 0,
      transcript: '',
      status: 'idle'
    };
  }

  onUnmounted(() => {
    cancelRecording();
  });

  return {
    state,
    transcript,
    isRecognizing,
    startRecording,
    stopRecording,
    cancelRecording,
    resetState
  };
}
