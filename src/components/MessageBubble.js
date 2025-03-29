import React from 'react';

function MessageBubble({ text, sender }) {
  return (
    <div className={`bubble ${sender}`}>
      <p>{text}</p>
    </div>
  );
}

export default MessageBubble;
