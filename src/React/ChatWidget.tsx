import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi — I can answer questions about Albert's experience, projects, and skills.",
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const apiMessages = useMemo(
    () => messages.filter((message) => message !== INITIAL_MESSAGE).slice(-10),
    [messages],
  );

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: question };
    const nextMessages = [...apiMessages, userMessage];

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || "The assistant is unavailable right now.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: payload.answer },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The assistant is unavailable right now.",
      );
    } finally {
      setIsLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <div className="portfolio-chat">
      {isOpen && (
        <section
          className="portfolio-chat__panel"
          aria-label="Portfolio assistant"
        >
          <header className="portfolio-chat__header">
            <div>
              <strong>Ask about Albert</strong>
              <span>RAGFlow + Ollama</span>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              className="portfolio-chat__icon-button"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="portfolio-chat__messages" aria-live="polite">
            {messages.map((message, index) => (
              <p
                className={`portfolio-chat__message portfolio-chat__message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
              </p>
            ))}
            {isLoading && (
              <p className="portfolio-chat__status">Thinking…</p>
            )}
          </div>

          {error && <p className="portfolio-chat__error">{error}</p>}

          <form className="portfolio-chat__form" onSubmit={submitMessage}>
            <label className="sr-only" htmlFor="portfolio-chat-input">
              Ask a question
            </label>
            <input
              id="portfolio-chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={800}
              placeholder="Ask about projects or experience…"
              disabled={isLoading}
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              Send
            </button>
          </form>
          <small>Answers are generated and may be imperfect.</small>
        </section>
      )}

      <button
        type="button"
        className="portfolio-chat__launcher"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close portfolio assistant" : "Open portfolio assistant"}
        onClick={() => {
          setIsOpen((current) => !current);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        {isOpen ? "×" : "Ask me"}
      </button>

      <style>{`
        .portfolio-chat {
          position: fixed;
          right: 1.25rem;
          bottom: 1.25rem;
          z-index: 80;
          font-family: inherit;
        }

        .portfolio-chat__launcher {
          min-width: 4rem;
          height: 3.25rem;
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--sec);
          color: var(--background);
          padding: 0 1.15rem;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.28);
        }

        .portfolio-chat__panel {
          position: absolute;
          right: 0;
          bottom: 4rem;
          display: grid;
          grid-template-rows: auto minmax(12rem, 1fr) auto auto auto;
          width: min(24rem, calc(100vw - 2.5rem));
          height: min(34rem, calc(100vh - 8rem));
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 1.25rem;
          background: var(--component-bg);
          color: var(--white);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
        }

        .portfolio-chat__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          border-bottom: 1px solid var(--border);
          padding: 1rem;
        }

        .portfolio-chat__header div {
          display: grid;
          gap: 0.1rem;
        }

        .portfolio-chat__header span,
        .portfolio-chat small {
          color: var(--white-icon);
          font-size: 0.75rem;
        }

        .portfolio-chat__icon-button {
          width: 2.25rem;
          height: 2.25rem;
          border: 0;
          border-radius: 999px;
          background: var(--white-icon-tr);
          color: var(--white);
          font-size: 1.45rem;
          cursor: pointer;
        }

        .portfolio-chat__messages {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          overflow-y: auto;
          padding: 1rem;
        }

        .portfolio-chat__message {
          max-width: 88%;
          margin: 0;
          border-radius: 1rem;
          padding: 0.7rem 0.85rem;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.45;
          font-size: 0.92rem;
        }

        .portfolio-chat__message--assistant {
          align-self: flex-start;
          background: var(--white-icon-tr);
        }

        .portfolio-chat__message--user {
          align-self: flex-end;
          background: var(--sec);
          color: var(--background);
        }

        .portfolio-chat__status,
        .portfolio-chat__error {
          margin: 0;
          padding: 0 1rem 0.65rem;
          font-size: 0.82rem;
        }

        .portfolio-chat__status {
          color: var(--white-icon);
        }

        .portfolio-chat__error {
          color: var(--error);
        }

        .portfolio-chat__form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.5rem;
          border-top: 1px solid var(--border);
          padding: 0.8rem;
        }

        .portfolio-chat__form input {
          min-width: 0;
          border: 1px solid var(--border);
          border-radius: 0.8rem;
          background: var(--background);
          color: var(--white);
          padding: 0.65rem 0.75rem;
        }

        .portfolio-chat__form button {
          border: 0;
          border-radius: 0.8rem;
          background: var(--sec);
          color: var(--background);
          padding: 0.65rem 0.85rem;
          font-weight: 800;
          cursor: pointer;
        }

        .portfolio-chat__form button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .portfolio-chat small {
          padding: 0 1rem 0.8rem;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 520px) {
          .portfolio-chat {
            right: 0.8rem;
            bottom: 0.8rem;
          }

          .portfolio-chat__panel {
            position: fixed;
            inset: 0.75rem 0.75rem 4.75rem;
            width: auto;
            height: auto;
          }
        }
      `}</style>
    </div>
  );
}
