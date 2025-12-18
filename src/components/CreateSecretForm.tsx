import { useState } from "react";
import { MessageSquare, FileUp, Mic, MessageCircle, Copy, QrCode, Share2, Clock, Eye, Lock, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SecretTypeCard } from "./SecretTypeCard";
import { FileUploader } from "./FileUploader";
import { VoiceRecorder } from "./VoiceRecorder";
import { SecretLinkDisplay } from "./SecretLinkDisplay";
import { generateKey, exportKey, encrypt, packEncrypted, generateSecureId } from "@/lib/crypto";
import { useToast } from "@/hooks/use-toast";

type SecretType = "message" | "files" | "voice" | "chat";

interface SecretOptions {
  expiration: string;
  viewLimit: number;
  password: string;
  requireClick: boolean;
  destroyAfterSeconds: number | null;
  allowManualDestroy: boolean;
}

export function CreateSecretForm() {
  const [secretType, setSecretType] = useState<SecretType>("message");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [options, setOptions] = useState<SecretOptions>({
    expiration: "1h",
    viewLimit: 1,
    password: "",
    requireClick: true,
    destroyAfterSeconds: null,
    allowManualDestroy: true,
  });
  const { toast } = useToast();

  const secretTypes = [
    { type: "message" as const, icon: MessageSquare, title: "Message", description: "Text or rich content" },
    { type: "files" as const, icon: FileUp, title: "Files", description: "Upload any files" },
    { type: "voice" as const, icon: Mic, title: "Voice Note", description: "Record audio" },
    { type: "chat" as const, icon: MessageCircle, title: "Chat Invite", description: "Ephemeral chat room" },
  ];

  const expirationOptions = [
    { value: "1m", label: "1 minute" },
    { value: "10m", label: "10 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "1d", label: "1 day" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
  ];

  const handleCreateSecret = async () => {
    if (secretType === "message" && !message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to encrypt.",
        variant: "destructive",
      });
      return;
    }

    if (secretType === "files" && files.length === 0) {
      toast({
        title: "Files required",
        description: "Please upload at least one file.",
        variant: "destructive",
      });
      return;
    }

    if (secretType === "voice" && !voiceBlob) {
      toast({
        title: "Voice note required",
        description: "Please record a voice note.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);

    try {
      // Generate encryption key
      const key = await generateKey();
      const keyString = await exportKey(key);
      
      // Generate secure ID
      const secretId = generateSecureId();

      // Encrypt content based on type
      let encryptedPayload: string;

      if (secretType === "message") {
        const { ciphertext, iv } = await encrypt(message, key);
        encryptedPayload = packEncrypted(iv, ciphertext);
      } else if (secretType === "files") {
        // For demo, encrypt file names as manifest
        const manifest = JSON.stringify(files.map(f => ({ name: f.name, size: f.size, type: f.type })));
        const { ciphertext, iv } = await encrypt(manifest, key);
        encryptedPayload = packEncrypted(iv, ciphertext);
      } else if (secretType === "voice") {
        const arrayBuffer = await voiceBlob!.arrayBuffer();
        const { ciphertext, iv } = await encrypt(arrayBuffer, key);
        encryptedPayload = packEncrypted(iv, ciphertext);
      } else {
        // Chat invite
        const chatManifest = JSON.stringify({ type: "chat", created: Date.now() });
        const { ciphertext, iv } = await encrypt(chatManifest, key);
        encryptedPayload = packEncrypted(iv, ciphertext);
      }

      // In production, this would be sent to the server
      // For now, we'll simulate with local storage (demo only)
      const secretData = {
        id: secretId,
        type: secretType,
        encryptedPayload,
        expiration: options.expiration,
        viewLimit: options.viewLimit,
        viewCount: 0,
        hasPassword: !!options.password,
        requireClick: options.requireClick,
        destroyAfterSeconds: options.destroyAfterSeconds,
        createdAt: Date.now(),
      };

      // Store encrypted data (demo - would be API call)
      localStorage.setItem(`burnlink_${secretId}`, JSON.stringify(secretData));

      // Generate link with key in fragment (never sent to server)
      const link = `${window.location.origin}/view/${secretId}#${keyString}`;
      setGeneratedLink(link);

      toast({
        title: "Secret created!",
        description: "Your encrypted link is ready to share.",
      });
    } catch (error) {
      console.error("Encryption error:", error);
      toast({
        title: "Encryption failed",
        description: "There was an error encrypting your secret.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    setGeneratedLink(null);
    setMessage("");
    setFiles([]);
    setVoiceBlob(null);
    setOptions({
      expiration: "1h",
      viewLimit: 1,
      password: "",
      requireClick: true,
      destroyAfterSeconds: null,
      allowManualDestroy: true,
    });
  };

  if (generatedLink) {
    return <SecretLinkDisplay link={generatedLink} onReset={handleReset} />;
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-fade-up">
      {/* Secret Type Selection */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">What do you want to send?</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secretTypes.map(({ type, icon, title, description }) => (
            <SecretTypeCard
              key={type}
              icon={icon}
              title={title}
              description={description}
              selected={secretType === type}
              onClick={() => setSecretType(type)}
            />
          ))}
        </div>
      </div>

      {/* Content Input */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        {secretType === "message" && (
          <div className="space-y-2">
            <Label htmlFor="message" className="text-sm font-medium">
              Your secret message
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your secret message here..."
              className="min-h-[150px] bg-background/50 border-border/50 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {message.length} characters • Will be encrypted with AES-256-GCM
            </p>
          </div>
        )}

        {secretType === "files" && (
          <FileUploader files={files} setFiles={setFiles} />
        )}

        {secretType === "voice" && (
          <VoiceRecorder voiceBlob={voiceBlob} setVoiceBlob={setVoiceBlob} />
        )}

        {secretType === "chat" && (
          <div className="text-center py-8">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-primary opacity-70" />
            <h3 className="text-lg font-semibold mb-2">Ephemeral Chat Room</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Create a temporary chat room. All messages are end-to-end encrypted and will be destroyed based on your settings.
            </p>
          </div>
        )}

        {/* Options */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <h3 className="font-medium flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            Destruction Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Expires after
              </Label>
              <Select
                value={options.expiration}
                onValueChange={(value) => setOptions({ ...options, expiration: value })}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expirationOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                View limit
              </Label>
              <Select
                value={options.viewLimit.toString()}
                onValueChange={(value) => setOptions({ ...options, viewLimit: parseInt(value) })}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? "view" : "views"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              Password protection (optional)
            </Label>
            <Input
              id="password"
              type="password"
              value={options.password}
              onChange={(e) => setOptions({ ...options, password: e.target.value })}
              placeholder="Add an extra layer of security..."
              className="bg-background/50"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
            <div>
              <Label htmlFor="require-click" className="text-sm font-medium">
                Require click to reveal
              </Label>
              <p className="text-xs text-muted-foreground">
                Content hidden until recipient confirms
              </p>
            </div>
            <Switch
              id="require-click"
              checked={options.requireClick}
              onCheckedChange={(checked) => setOptions({ ...options, requireClick: checked })}
            />
          </div>
        </div>
      </div>

      {/* Create Button */}
      <Button
        onClick={handleCreateSecret}
        disabled={isCreating}
        variant="ember"
        size="xl"
        className="w-full"
      >
        {isCreating ? (
          <>
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Encrypting...
          </>
        ) : (
          <>
            <Flame className="w-5 h-5" />
            Create Self-Destructing Link
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your content is encrypted in the browser. The encryption key is only in the link — we never see it.
      </p>
    </div>
  );
}
