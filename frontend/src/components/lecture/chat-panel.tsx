"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Bot,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatPanelProps {
  lectureId: string;
}

export function ChatPanel({ lectureId }: ChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { lectureId } }),
    [lectureId]
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", lectureId] });
      queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue("");
    await sendMessage({ text });
  };

  const handleSuggestion = async (text: string) => {
    if (isLoading) return;
    setInputValue("");
    await sendMessage({ text });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full btn-gradient shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] h-[600px] max-h-[calc(100vh-48px)] glass rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Edit captions, search content, and more</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 rounded-lg"
          onClick={() => setOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Bot className="w-10 h-10 text-muted-foreground/50 mx-auto" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">How can I help?</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Try: &quot;Remove all filler words&quot; or &quot;Find where pointers are discussed&quot;
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                "Remove filler words",
                "Fix grammar in all captions",
                "Summarize this lecture",
                "What's the accessibility score?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestion(suggestion)}
                  className="glass-subtle px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "btn-gradient text-white"
                  : "glass-subtle"
              }`}
            >
              {m.parts?.map((part, i) => {
                if (part.type === "text") {
                  return <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                }
                if (part.type.startsWith("tool-")) {
                  const p = part as { state: string; toolName?: string; output?: unknown; toolCallId?: string; type: string };
                  const result = p.state === "result" ? p.output as Record<string, unknown> | undefined : undefined;
                  const isError = result && "error" in result;
                  const toolName = p.type.replace(/^tool-/, "") || p.toolName || "tool";
                  return (
                    <div key={i} className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.state === "result" ? (
                        isError ? (
                          <AlertCircle className="w-3 h-3 text-destructive" />
                        ) : (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )
                      ) : (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <span>
                        {p.state === "result"
                          ? (result?.message as string) ?? (result?.error as string) ?? "Done"
                          : `Running ${toolName}…`}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>
            {m.role === "user" && (
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="glass-subtle rounded-xl px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {error.message}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border/50 flex gap-2">
        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything about your lecture..."
          className="flex-1 bg-transparent border border-border/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          disabled={isLoading}
        />
        <Button
          type="submit"
          size="icon"
          className="w-9 h-9 rounded-xl btn-gradient shrink-0"
          disabled={isLoading || !inputValue.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
