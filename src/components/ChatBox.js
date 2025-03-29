// AutoFix Assistant – Cleaner UI without pre-built prompts

import React, { useState, useRef } from 'react';
import axios from 'axios';
import MessageBubble from './MessageBubble';
import '../styles.css';

function ChatBox() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSend = async () => {
    if (!input.trim()) return;
  
    const userMessage = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
  
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
        }
      );
  
      const assistantMessage = {
        text: response.data.choices[0].message.content,
        sender: 'bot',
      };
  
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error from OpenAI:', error);
      alert('Something went wrong while talking to AutoFix Assistant.');
    }
  
    setInput('');
  };  

  const handleRecord = async () => {
    if (!isRecording) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.start();
      setIsRecording(true);

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

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
            }
          );          

          const transcribed = response.data.text;
          setInput(transcribed);
        } catch (err) {
          console.error('Whisper error:', err);
          alert('Voice transcription failed.');
        }
      };
    } else {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleExport = () => {
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
      <h1 className="chat-title"></h1> 

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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
        <button onClick={handleRecord}>{isRecording ? 'Stop 🎙️' : 'Mic 🎤'}</button>
        <button onClick={handleExport}>Download 📝</button>
      </div>
    </div>
  );
}

export default ChatBox;
