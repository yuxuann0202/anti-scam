import React, { useState } from 'react';
import '../styles/InputForm.css';

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+/i;

function MessageInput({ onScan, t }) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasLink = URL_PATTERN.test(message);

  const handleScan = async () => {
    if (!message.trim()) {
      setError(t('errorMsgEmpty'));
      return;
    }
    if (message.length < 5) {
      setError(t('errorMsgShort'));
      return;
    }
    if (hasLink) {
      setError(t('errorMsgHasLink'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/scan-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, lang: t('langCode') || 'en', aiModel: 'auto' })
      });

      const result = await response.json();

      if (result.success) {
        onScan({ type: 'message', content: message, scanMode: 'auto', ...result.data });
        setMessage('');
      } else {
        setError(result.error || result.details || t('connError'));
      }
    } catch (error) {
      setError(t('connError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMessage(text);
      setError('');
    } catch {
      setError(t('connError'));
    }
  };

  return (
    <div className="input-form">
      <div className="form-group">
        <label htmlFor="message-input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'text-bottom' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {t('labelPasteMsg')}
        </label>
        <textarea
          id="message-input"
          className={`message-textarea ${error || hasLink ? 'error' : ''}`}
          value={message}
          onChange={(e) => { setMessage(e.target.value); setError(''); }}
          onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleScan(); } }}
          placeholder={t('placeholderMsg')}
          rows="8"
        />
        {hasLink
          ? <div className="error-message">{t('errorMsgHasLink')}</div>
          : error && <div className="error-message">{error}</div>
        }
        <div className="character-count">{t('charCount', { count: message.length })}</div>
      </div>

      <div className="input-actions" style={{ position: 'relative' }}>
        <button className="btn-secondary" onClick={handlePaste}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {t('btnPaste')}
        </button>
        <button className="btn-primary" onClick={handleScan} disabled={isLoading || !message.trim() || hasLink}>
          {isLoading ? (
            <><span className="spinner"/>{t('analyzing')}</>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              {t('btnCheckMsg')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
