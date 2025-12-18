import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import { BurnLinkLogo } from "@/components/BurnLinkLogo";
import { EmberParticles } from "@/components/EmberParticles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  Eye, 
  Clock, 
  Flame, 
  Lock, 
  MessageSquare, 
  FileUp, 
  Mic,
  Copy,
  Download,
  Check,
  Play,
  Pause,
  FileIcon,
  ImageIcon,
  VideoIcon,
  FileTextIcon,
  Send,
  MessageCircle
} from "lucide-react";
import { importKey, decryptToString, unpackEncrypted } from "@/lib/crypto";
import { useToast } from "@/hooks/use-toast";

type SecretStatus = "loading" | "ready" | "revealed" | "destroyed" | "expired" | "not-found";

interface SecretData {
  id: string;
  type: "message" | "files" | "voice" | "chat";
  encryptedPayload: string;
  expiration: string;
  viewLimit: number;
  viewCount: number;
  hasPassword: boolean;
  requireClick: boolean;
  destroyAfterSeconds: number | null;
  createdAt: number;
}

interface FileData {
  name: string;
  size: number;
  type: string;
  data: string;
}

interface VoiceData {
  audio: string;
  type: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
}

export default function ViewSecret() {
  const { secretId } = useParams();
  const location = useLocation();
  const [status, setStatus] = useState<SecretStatus>("loading");
  const [secret, setSecret] = useState<SecretData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decryptedFiles, setDecryptedFiles] = useState<FileData[]>([]);
  const [decryptedVoice, setDecryptedVoice] = useState<VoiceData | null>(null);
  const [password, setPassword] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isBurning, setIsBurning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [nickname] = useState(() => `User${Math.floor(Math.random() * 9999)}`);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Get key from URL fragment (never sent to server)
  const keyString = location.hash.slice(1);

  useEffect(() => {
    loadSecret();
  }, [secretId]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handleDestroy();
    }
  }, [countdown]);

  const loadSecret = async () => {
    if (!secretId) {
      setStatus("not-found");
      return;
    }

    // Demo: Load from localStorage (would be API call)
    const storedData = localStorage.getItem(`burnlink_${secretId}`);
    
    if (!storedData) {
      setStatus("not-found");
      return;
    }

    try {
      const data: SecretData = JSON.parse(storedData);
      
      // Check if already destroyed
      if (data.viewCount >= data.viewLimit) {
        setStatus("destroyed");
        return;
      }

      // Check expiration
      const expirationMs = parseExpiration(data.expiration);
      if (Date.now() > data.createdAt + expirationMs) {
        setStatus("expired");
        localStorage.removeItem(`burnlink_${secretId}`);
        return;
      }

      setSecret(data);
      
      if (data.hasPassword) {
        setPasswordRequired(true);
      }
      
      setStatus("ready");
    } catch (error) {
      console.error("Error loading secret:", error);
      setStatus("not-found");
    }
  };

  const parseExpiration = (exp: string): number => {
    const match = exp.match(/(\d+)([mhd])/);
    if (!match) return 3600000; // Default 1 hour
    const [, num, unit] = match;
    const multipliers: Record<string, number> = {
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    return parseInt(num) * (multipliers[unit] || 3600000);
  };

  const handleReveal = async () => {
    if (!keyString || !secret) {
      toast({
        title: "Decryption failed",
        description: "Invalid or missing encryption key",
        variant: "destructive",
      });
      return;
    }

    try {
      const key = await importKey(keyString);
      const { iv, ciphertext } = unpackEncrypted(secret.encryptedPayload);
      const decrypted = await decryptToString(ciphertext, key, iv);
      
      // Handle different content types
      if (secret.type === "message") {
        setDecryptedContent(decrypted);
      } else if (secret.type === "files") {
        const filesData: FileData[] = JSON.parse(decrypted);
        setDecryptedFiles(filesData);
      } else if (secret.type === "voice") {
        const voiceData: VoiceData = JSON.parse(decrypted);
        setDecryptedVoice(voiceData);
      } else if (secret.type === "chat") {
        // Initialize chat
        setDecryptedContent(decrypted);
      }
      
      setStatus("revealed");

      // Update view count (demo)
      const updatedSecret = { ...secret, viewCount: secret.viewCount + 1 };
      localStorage.setItem(`burnlink_${secretId}`, JSON.stringify(updatedSecret));

      // Start destruction countdown if configured
      if (secret.destroyAfterSeconds) {
        setCountdown(secret.destroyAfterSeconds);
      }

      // If last view, schedule destruction
      if (updatedSecret.viewCount >= secret.viewLimit) {
        setTimeout(() => handleDestroy(), 30000); // 30 seconds to read
      }
    } catch (error) {
      console.error("Decryption error:", error);
      toast({
        title: "Decryption failed",
        description: "Could not decrypt the secret. The link may be corrupted.",
        variant: "destructive",
      });
    }
  };

  const handleDestroy = () => {
    setIsBurning(true);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setTimeout(() => {
      localStorage.removeItem(`burnlink_${secretId}`);
      setStatus("destroyed");
      setIsBurning(false);
    }, 1000);
  };

  const handleCopy = async () => {
    if (decryptedContent) {
      await navigator.clipboard.writeText(decryptedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadFile = (file: FileData) => {
    const binary = atob(file.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: file.type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    decryptedFiles.forEach((file) => handleDownloadFile(file));
  };

  const playVoice = () => {
    if (!decryptedVoice) return;
    
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const binary = atob(decryptedVoice.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: decryptedVoice.type });
    const url = URL.createObjectURL(blob);
    
    audioRef.current = new Audio(url);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play();
    setIsPlaying(true);
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text: chatInput,
      sender: nickname,
      timestamp: Date.now(),
    };
    
    setChatMessages((prev) => [...prev, newMessage]);
    setChatInput("");
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.startsWith("video/")) return VideoIcon;
    if (type.startsWith("text/") || type.includes("document")) return FileTextIcon;
    return FileIcon;
  };

  const isPreviewable = (type: string) => {
    return type.startsWith("image/") || type.startsWith("video/");
  };

  const getTypeIcon = () => {
    switch (secret?.type) {
      case "message": return MessageSquare;
      case "files": return FileUp;
      case "voice": return Mic;
      case "chat": return MessageCircle;
      default: return MessageSquare;
    }
  };

  const getTimeRemaining = () => {
    if (!secret) return "";
    const expirationMs = parseExpiration(secret.expiration);
    const remaining = secret.createdAt + expirationMs - Date.now();
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    
    if (hours > 24) return `${Math.floor(hours / 24)} days`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} minutes`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const TypeIcon = getTypeIcon();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-dark pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial-ember opacity-30 pointer-events-none" />
      <EmberParticles intensity={isBurning ? "high" : "low"} />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-md bg-background/50">
        <div className="container mx-auto px-4 py-4">
          <BurnLinkLogo />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className={`w-full max-w-lg ${isBurning ? 'animate-burn-out' : 'animate-fade-up'}`}>
          {status === "loading" && (
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading secret...</p>
            </div>
          )}

          {status === "not-found" && (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Secret Not Found</h1>
              <p className="text-muted-foreground">
                This secret doesn't exist or has already been destroyed.
              </p>
            </div>
          )}

          {status === "destroyed" && (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 flex items-center justify-center animate-ember-pulse">
                <Flame className="w-8 h-8 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Secret Destroyed</h1>
              <p className="text-muted-foreground">
                This secret has been permanently destroyed and cannot be recovered.
              </p>
            </div>
          )}

          {status === "expired" && (
            <div className="glass-card rounded-xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Secret Expired</h1>
              <p className="text-muted-foreground">
                This secret has expired and been automatically destroyed.
              </p>
            </div>
          )}

          {status === "ready" && secret && (
            <div className="glass-card rounded-xl p-8 space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                  <TypeIcon className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Someone sent you a secret</h1>
                <p className="text-muted-foreground">
                  This {secret.type === "voice" ? "voice note" : secret.type === "chat" ? "chat room" : secret.type} will self-destruct after viewing.
                </p>
              </div>

              <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Expires in
                  </span>
                  <span className="font-medium">{getTimeRemaining()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Views remaining
                  </span>
                  <span className="font-medium">{secret.viewLimit - secret.viewCount}</span>
                </div>
                {secret.hasPassword && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Password protected
                    </span>
                    <span className="font-medium text-primary">Yes</span>
                  </div>
                )}
              </div>

              {passwordRequired && (
                <div className="space-y-2">
                  <Label htmlFor="password">Enter password to decrypt</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password..."
                    className="bg-background/50"
                  />
                </div>
              )}

              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm text-destructive">This action is irreversible</p>
                    <p className="text-sm text-muted-foreground">
                      Once you view this secret, it will be destroyed forever.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleReveal}
                variant="burn"
                size="xl"
                className="w-full"
              >
                <Flame className="w-5 h-5" />
                View & Destroy
              </Button>
            </div>
          )}

          {/* Revealed Message */}
          {status === "revealed" && secret?.type === "message" && decryptedContent && (
            <div className="glass-card rounded-xl p-8 space-y-6">
              {countdown !== null && (
                <div className="text-center p-3 rounded-lg bg-destructive/20 border border-destructive/30">
                  <p className="text-sm text-destructive">
                    Auto-destroying in <span className="font-bold">{countdown}</span> seconds
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">Decrypted Message</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopy}
                    className="h-8"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="p-4 rounded-lg bg-background/80 border border-border/50 min-h-[100px] whitespace-pre-wrap break-words">
                  {decryptedContent}
                </div>
              </div>

              <Button
                onClick={handleDestroy}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                <Flame className="w-4 h-4" />
                Destroy Now
              </Button>
            </div>
          )}

          {/* Revealed Files */}
          {status === "revealed" && secret?.type === "files" && decryptedFiles.length > 0 && (
            <div className="glass-card rounded-xl p-8 space-y-6">
              {countdown !== null && (
                <div className="text-center p-3 rounded-lg bg-destructive/20 border border-destructive/30">
                  <p className="text-sm text-destructive">
                    Auto-destroying in <span className="font-bold">{countdown}</span> seconds
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    {decryptedFiles.length} file{decryptedFiles.length > 1 ? "s" : ""} decrypted
                  </Label>
                  {decryptedFiles.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={handleDownloadAll}>
                      <Download className="w-4 h-4" />
                      Download All
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {decryptedFiles.map((file, index) => {
                    const FileIconComponent = getFileIcon(file.type);
                    const previewUrl = isPreviewable(file.type)
                      ? `data:${file.type};base64,${file.data}`
                      : null;

                    return (
                      <div key={index} className="rounded-lg border border-border/50 overflow-hidden bg-background/50">
                        {/* Preview for images/videos */}
                        {previewUrl && file.type.startsWith("image/") && (
                          <div className="w-full max-h-64 overflow-hidden">
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="w-full h-full object-contain bg-black/20"
                            />
                          </div>
                        )}
                        {previewUrl && file.type.startsWith("video/") && (
                          <div className="w-full">
                            <video
                              src={previewUrl}
                              controls
                              className="w-full max-h-64"
                            />
                          </div>
                        )}

                        <div className="p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileIconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadFile(file)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleDestroy}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                <Flame className="w-4 h-4" />
                Destroy Now
              </Button>
            </div>
          )}

          {/* Revealed Voice Note */}
          {status === "revealed" && secret?.type === "voice" && decryptedVoice && (
            <div className="glass-card rounded-xl p-8 space-y-6">
              {countdown !== null && (
                <div className="text-center p-3 rounded-lg bg-destructive/20 border border-destructive/30">
                  <p className="text-sm text-destructive">
                    Auto-destroying in <span className="font-bold">{countdown}</span> seconds
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <Label className="text-sm text-muted-foreground">Voice Note</Label>

                <div className="flex flex-col items-center py-8 space-y-4">
                  <button
                    onClick={playVoice}
                    className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90 shadow-ember flex items-center justify-center transition-all"
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8 text-primary-foreground" />
                    ) : (
                      <Play className="w-8 h-8 text-primary-foreground ml-1" />
                    )}
                  </button>
                  <p className="text-sm text-muted-foreground">
                    {isPlaying ? "Playing..." : "Click to play"}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleDestroy}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                <Flame className="w-4 h-4" />
                Destroy Now
              </Button>
            </div>
          )}

          {/* Chat Room */}
          {status === "revealed" && secret?.type === "chat" && (
            <div className="glass-card rounded-xl p-6 space-y-4 max-w-lg w-full">
              {countdown !== null && (
                <div className="text-center p-3 rounded-lg bg-destructive/20 border border-destructive/30">
                  <p className="text-sm text-destructive">
                    Room closes in <span className="font-bold">{countdown}</span> seconds
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="font-semibold">Ephemeral Chat</h3>
                  <p className="text-xs text-muted-foreground">Messages are E2E encrypted</p>
                </div>
                <div className="text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded">
                  {nickname}
                </div>
              </div>

              <div className="h-64 overflow-y-auto space-y-3 p-2 bg-background/30 rounded-lg">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg max-w-[80%] ${
                        msg.sender === nickname
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-xs opacity-70 mb-1">{msg.sender}</p>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Type a message..."
                  className="bg-background/50"
                />
                <Button onClick={sendChatMessage} variant="ember" size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={handleDestroy}
                variant="destructive"
                size="lg"
                className="w-full"
              >
                <Flame className="w-4 h-4" />
                End & Destroy Chat
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}