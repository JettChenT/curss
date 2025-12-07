"use client";

import { useState } from "react";
import { Copy, Check, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface SubscribeButtonProps {
  rssUrl: string;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function SubscribeButton({
  rssUrl,
  variant = "outline",
  size = "sm",
  className = "w-full",
}: SubscribeButtonProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Generate feed URLs for different formats based on the base RSS URL
  const feedUrls = {
    RSS: rssUrl,
    Atom: rssUrl.replace("format=rss", "format=atom"),
    JSON: rssUrl.replace("format=rss", "format=jsonfeed"),
  };

  const handleCopy = async (
    format: keyof typeof feedUrls,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(feedUrls[format]);
      setCopiedFormat(format);
      toast.success(`${format} feed URL copied to clipboard!`);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to copy ${format} feed URL`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          Subscribe
          <Rss className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[300px]">
        <DropdownMenuLabel>Choose Feed Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => handleCopy("RSS", e)}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>RSS 2.0</span>
          {copiedFormat === "RSS" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleCopy("Atom", e)}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>Atom 1.0</span>
          {copiedFormat === "Atom" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => handleCopy("JSON", e)}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>JSON Feed</span>
          {copiedFormat === "JSON" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
