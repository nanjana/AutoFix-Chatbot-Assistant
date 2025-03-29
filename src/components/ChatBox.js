import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import '../styles.css';

function ChatBox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Listen to online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      alert('You are offline. Please check your internet connection.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!isOnline) return alert('No internet connection.');
    if (!process.env.REACT_APP_OPENAI_API_KEY) return alert('Missing API key.');

    const userMessage = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert automotive assistant. Help users with car problems and give helpful advice.',
            },
            { role: 'user', content: input },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const assistantReply = response?.data?.choices?.[0]?.message?.content;
      if (!assistantReply) return alert('Unexpected response from AutoFix Assistant.');

      setMessages((prev) => [...prev, { text: assistantReply, sender: 'bot' }]);
    } catch (error) {
      console.error('OpenAI Error:', error);
      if (error.response?.status === 401) alert('Invalid API key.');
      else if (error.response?.status === 429) alert('Rate limit exceeded. Try again later.');
      else alert('Something went wrong while talking to AutoFix Assistant.');
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support microphone access.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          alert('No audio captured. Please try again.');
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.webm');
        formData.append('model', 'whisper-1');

        try {
          const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
              headers: {
                Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
                'Content-Type': 'multipart/form-data',
              },
              timeout: 15000,
            }
          );

          const transcribed = response.data?.text;
          if (!transcribed) alert('Could not understand audio.');
          else setInput(transcribed);
        } catch (err) {
          console.error('Whisper API error:', err);
          alert('Voice transcription failed.');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Mic error:', error);
      alert('Microphone access was denied or failed.');
    }
  };

  const handleExport = () => {
    if (messages.length === 0) {
      alert('No messages to export.');
      return;
    }

    const textData = messages.map(m => `${m.sender === 'user' ? 'You' : 'AutoFix'}: ${m.text}`).join('\n');
    const blob = new Blob([textData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AutoFix_Report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chatbox">
      <h1 className="chat-title">🚗 AutoFix Assistant</h1>

      <div className="messages">
        {messages.map((msg, i) => (
          <MessageBubble key={i} text={msg.text} sender={msg.sender} />
        ))}
      </div>

      <div className="input-row spaced-buttons">
        <input
          placeholder="Type or record your car issue..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && input.trim() && handleSend()}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>Send</button>
        <button onClick={handleRecord}>{isRecording ? 'Stop 🎙️' : 'Mic 🎤'}</button>
        <button onClick={handleExport} disabled={messages.length === 0}>Download 📝</button>
      </div>
    </div>
  );
}

export default ChatBox;