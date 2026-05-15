import { useState, useEffect, useRef } from 'react';

interface UseSpeechToTextProps {
  onResult: (text: string) => void;
  lang?: string;
}

export const useSpeechToText = ({ onResult, lang = 'es-419' }: UseSpeechToTextProps) => {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isManualStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 2;

  const cleanup = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (e) {
        // ignore cleanup errors
      }
      recognitionRef.current = null;
    }
  };

  const startListening = () => {
    cleanup(); // ALWAYS clean before new instance
    
    // Check support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('not-supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      isManualStopRef.current = false;
      retryCountRef.current = 0;
      // Emit global event to show indicator
      window.dispatchEvent(new CustomEvent('speech-listening-start'));
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      onResult(finalTranscript + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.log('Speech error:', event.error);
      
      const restartableErrors = ['no-speech', 'audio-capture', 'network'];
      
      if (restartableErrors.includes(event.error) && !isManualStopRef.current && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => {
          if (!isManualStopRef.current) {
            startListening(); // retry
          }
        }, 500);
      } else {
        setError(event.error);
        setIsListening(false);
        cleanup();
        window.dispatchEvent(new CustomEvent('speech-listening-end'));
      }
    };

    recognition.onend = () => {
      // If ended but not manual stop, restart
      if (!isManualStopRef.current && retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        setTimeout(() => {
          if (!isManualStopRef.current) {
            try {
              if (recognitionRef.current) {
                recognitionRef.current.start();
              } else {
                startListening();
              }
            } catch (e) {
              setIsListening(false);
              cleanup();
              window.dispatchEvent(new CustomEvent('speech-listening-end'));
            }
          }
        }, 100);
      } else {
        setIsListening(false);
        window.dispatchEvent(new CustomEvent('speech-listening-end'));
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError('start-failed');
      cleanup();
    }
  };

  const stopListening = () => {
    isManualStopRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  useEffect(() => {
    return () => {
      isManualStopRef.current = true;
      cleanup();
    };
  }, []);

  return { isListening, error, startListening, stopListening };
};
