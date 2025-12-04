"use client";

import { useState, useRef, useEffect } from "react";
import { Rss } from "lucide-react";
import { Button } from "./button";

interface SubscribeButtonProps {
  rssUrl: string;
}

export function SubscribeButton({ rssUrl }: SubscribeButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rssUrl);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="w-full">
      <Rss className="size-4" />
      {copied ? "Copied RSS url" : "Subscribe"}
    </Button>
  );
}
