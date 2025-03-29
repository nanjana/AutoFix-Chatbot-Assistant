import React, { useState, useRef } from 'react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import '../styles.css';

function ChatBox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!navigator.onLine) {
      alert('You are offline. Please check your internet connection.');
      return;
    }
    if (!process.env.REACT_APP_OPENAI_API_KEY) {
      alert('Missing API key. Please check your environment configuration.');
      return;
    }

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
              content:
                'You are an expert automotive assistant. Help users with car problems and give helpful advice.',
            },
            { role: 'user', content: input },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10s timeout in case API hangs
        }
      );

      if (
        !response.data ||
        !response.data.choices ||
        !response.data.choices[0] ||
        !response.data.choices[0].message
      ) {
        alert('Unexpected response from AutoFix Assistant.');
        return;
      }

      const assistantMessage = {
        text: response.data.choices[0].message.content,
        sender: 'bot',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('OpenAI Chat Error:', error);
      if (error.response) {
        if (error.response.status === 401) {
          alert('Invalid API key.');
        } else if (error.response.status === 429) {
          alert('Too many requests. Try again later.');
        } else {
          alert(`Server error: ${error.response.status}`);
        }
      } else {
        alert('Failed to connect to AutoFix Assistant.');
      }
    } finally {
      setIsLoading(false);
      setInput('');
    }
  };

  const handleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support audio recording.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      alert('Microphone access denied or unavailable.');
      return;
    }

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    setIsRecording(true);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      if (audioChunksRef.current.length === 0) {
        alert('No audio recorded. Please try again.');
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

        const transcribed = response.data.text;
        if (!transcribed) {
          alert('Could not understand audio.');
        } else {
          setInput(transcribed);
        }
      } catch (err) {
        console.error('Whisper error:', err);
        alert('Voice transcription failed.');
      }
    };

    mediaRecorder.start();
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
      <h1 className="chat-title">AutoFix Assistant</h1>

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
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
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
