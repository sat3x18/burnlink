import { useState } from "react";
import { Copy, QrCode, Share2, Check, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";

interface SecretLinkDisplayProps {
  link: string;
  onReset: () => void;
}

export function SecretLinkDisplay({ link, onReset }: SecretLinkDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "BurnLink Secret",
          text: "I'm sharing a self-destructing message with you",
          url: link,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 animate-fade-up">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-4 animate-ember-pulse">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Your secret link is ready!</h2>
        <p className="text-muted-foreground">
          Share this link securely. Once viewed, it will self-destruct.
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="p-4 bg-background/50 rounded-lg border border-border/50 break-all font-mono text-sm">
          {link}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleCopy}
            variant="ember"
            size="lg"
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            onClick={() => setShowQR(!showQR)}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? "Hide QR" : "Show QR"}
          </Button>
          <Button
            onClick={handleShare}
            variant="outline"
            size="lg"
            className="flex-1"
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>

        {showQR && (
          <div className="flex justify-center p-6 bg-white rounded-lg animate-scale-in">
            <QRCodeSVG
              value={link}
              size={200}
              level="H"
              includeMargin
              bgColor="#ffffff"
              fgColor="#0a0a0b"
            />
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl p-4 border-primary/30 bg-primary/5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">Security Notice</p>
            <p className="text-sm text-muted-foreground">
              The encryption key is embedded in this link. Anyone with this link can view your secret.
              Share it only through secure, trusted channels.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Button
          onClick={onReset}
          variant="ghost"
          size="lg"
        >
          <RotateCcw className="w-4 h-4" />
          Create Another Secret
        </Button>
      </div>
    </div>
  );
}
