import { BurnLinkLogo } from "@/components/BurnLinkLogo";
import { CreateSecretForm } from "@/components/CreateSecretForm";
import { EmberParticles } from "@/components/EmberParticles";
import { Shield, Lock, Flame, Eye, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-dark pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial-ember opacity-30 pointer-events-none" />
      <EmberParticles intensity="low" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-md bg-background/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BurnLinkLogo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Github className="w-4 h-4 mr-2" />
              Open Source
            </Button>
            <Button variant="ember-outline" size="sm">
              How It Works
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12 space-y-4 animate-burn-in">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="text-foreground">Share secrets that </span>
            <span className="ember-text">burn after reading</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            End-to-end encrypted messages, files, and voice notes that self-destruct. 
            Your secrets never touch our servers in plain text.
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span>AES-256-GCM Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <span>Zero-Knowledge Architecture</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-primary" />
            <span>View Once & Destroy</span>
          </div>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            <span>Auto-Expiration</span>
          </div>
        </div>

        {/* Main Form */}
        <CreateSecretForm />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <BurnLinkLogo size="sm" showText={false} />
              <span>BurnLink — Privacy-first messaging</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Open Source</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
