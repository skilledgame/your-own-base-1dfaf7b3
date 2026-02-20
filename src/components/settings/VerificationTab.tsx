/**
 * Verification Tab - Identity verification, KYC
 */

import { useState } from 'react';
import { BadgeCheck, Upload, FileText, Camera, CheckCircle2, Clock, AlertCircle, ChevronRight, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type VerificationStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: VerificationStatus;
}

export function VerificationTab() {
  const [verificationSteps] = useState<VerificationStep[]>([
    {
      id: 'email',
      title: 'Email Verification',
      description: 'Confirm your email address',
      icon: CheckCircle2,
      status: 'verified'
    },
    {
      id: 'identity',
      title: 'Identity Document',
      description: 'Upload a valid government ID',
      icon: FileText,
      status: 'not_started'
    },
    {
      id: 'selfie',
      title: 'Selfie Verification',
      description: 'Take a photo holding your ID',
      icon: Camera,
      status: 'not_started'
    },
    {
      id: 'address',
      title: 'Proof of Address',
      description: 'Upload a utility bill or bank statement',
      icon: FileText,
      status: 'not_started'
    }
  ]);

  const completedSteps = verificationSteps.filter(s => s.status === 'verified').length;
  const progress = (completedSteps / verificationSteps.length) * 100;

  const getStatusBadge = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-accent/20 text-accent border-accent/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Verified
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground">
            Not Started
          </Badge>
        );
    }
  };

  const handleStartVerification = (stepId: string) => {
    toast.info('Verification coming soon!');
  };

  return (
    <div className="space-y-6">
      {/* Verification Overview */}
      <Card className="border-border bg-card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-accent" />
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-md bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
              <BadgeCheck className="w-7 h-7 text-accent" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl font-bold">Account Verification</CardTitle>
              <CardDescription>Verify your identity to unlock all features</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-muted-foreground">{completedSteps}/{verificationSteps.length} completed</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-md bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Withdrawal Limit</p>
              <p className="text-lg font-bold text-foreground">$500/day</p>
              <p className="text-xs text-accent mt-1">+$10,000 after full verification</p>
            </div>
            <div className="p-4 rounded-md bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Deposit Limit</p>
              <p className="text-lg font-bold text-foreground">$1,000/day</p>
              <p className="text-xs text-accent mt-1">Unlimited after verification</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Steps */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Verification Steps</CardTitle>
          <CardDescription>Complete all steps to verify your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {verificationSteps.map((step, index) => (
            <div 
              key={step.id}
              className={`p-4 rounded-md border transition-all ${
                step.status === 'verified' 
                  ? 'bg-accent/5 border-accent/20' 
                  : 'bg-muted/30 border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                  step.status === 'verified' 
                    ? 'bg-accent/20' 
                    : 'bg-muted'
                }`}>
                  <step.icon className={`w-5 h-5 ${
                    step.status === 'verified' ? 'text-accent' : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{step.title}</p>
                    {getStatusBadge(step.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                </div>
                {step.status !== 'verified' && (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleStartVerification(step.id)}
                    className="shrink-0"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Verification Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {[
              { text: 'Higher withdrawal limits', icon: '💰' },
              { text: 'Access to tournaments', icon: '🏆' },
              { text: 'Priority support', icon: '⚡' },
              { text: 'Exclusive promotions', icon: '🎁' },
              { text: 'Verified badge on profile', icon: '✓' }
            ].map((benefit, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border"
              >
                <span className="text-xl">{benefit.icon}</span>
                <p className="text-sm font-medium">{benefit.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trust & Safety */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-accent">Your data is secure</p>
              <p className="text-xs text-muted-foreground mt-1">
                All documents are encrypted and stored securely. We comply with international data protection regulations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
