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

  const permissionError = ref<string | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let timer: number | null = null;
  let analyser: AnalyserNode | null = null;
  let audioContext: AudioContext | null = null;
  let mediaStream: MediaStream | null = null;

  const { transcript, isRecognizing, startRecognition, stopRecognition, abortRecognition } = useSpeechRecognition();

  async function startRecording() {
    permissionError.value = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStream = stream;

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

    } catch (e: any) {
      console.error('Recording error:', e);

      let errorMessage = '录音启动失败';

      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许使用麦克风';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        errorMessage = '未找到麦克风设备，请连接麦克风后重试';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        errorMessage = '麦克风被其他应用占用，请关闭其他使用麦克风的程序';
      } else if (e.name === 'SecurityError' || e.name === 'NotSupportedError') {
        errorMessage = '浏览器不支持录音功能，请使用 Chrome、Edge 或 Safari 浏览器';
      } else {
        errorMessage = `录音失败: ${e.message || '未知错误'}`;
      }

      permissionError.value = errorMessage;
      state.value = {
        isRecording: false,
        duration: 0,
        audioLevel: 0,
        transcript: '',
        status: 'error'
      };
    }
  }

  async function stopRecording(): Promise<{ audioBlob: Blob | null; transcript: string }> {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
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
        if (mediaStream) {
          mediaStream.getTracks().forEach(track => track.stop());
          mediaStream = null;
        }
      } catch (e) {
        console.error('Stop recording error:', e);
      }
    });
  }

  function cancelRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try {
        mediaRecorder.stop();
      } catch (e) {
      }
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
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
    permissionError.value = null;
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
    permissionError,
    transcript,
    isRecognizing,
    startRecording,
    stopRecording,
    cancelRecording,
    resetState
  };
}
