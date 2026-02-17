import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { ClanInfo } from '@/components/clan/ClanInfo';
import { ClanMemberList } from '@/components/clan/ClanMemberList';
import { CreateClanForm } from '@/components/clan/CreateClanForm';
import { ClanBrowser } from '@/components/clan/ClanBrowser';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/hooks/useClan';
import { useClanStore } from '@/stores/clanStore';
import { toast } from 'sonner';
import skilledLogo from '@/assets/skilled-logo.png';

export default function Clan() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const {
    clan,
    members,
    isInClan,
    isLeader,
    loading,
    createClan,
    joinClan,
    leaveClan,
    searchClans,
    fetchClan,
  } = useClan();

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (user?.id) {
      fetchClan(user.id);
    }
  }, [isAuthReady, isAuthenticated, user?.id, navigate, fetchClan]);

  const handleLeave = async () => {
    if (!confirm('Are you sure you want to leave this clan?')) return;
    setLeaving(true);
    try {
      await leaveClan();
      toast.success('Left clan');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave');
    } finally {
      setLeaving(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <DesktopSideMenu isOpen={sideMenuOpen} onToggle={() => setSideMenuOpen(!sideMenuOpen)} />

      {sideMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSideMenuOpen(false)}
        />
      )}

      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <img src={skilledLogo} alt="Skilled" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Clan</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/clan/leaderboard')}
            className="text-primary"
          >
            <Trophy className="w-4 h-4 mr-1" />
            Rankings
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading && !clan ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse text-muted-foreground">Loading clan...</div>
          </div>
        ) : isInClan && clan ? (
          <>
            <ClanInfo
              clan={clan}
              isLeader={isLeader}
              onLeave={handleLeave}
              leaving={leaving}
            />

            <Tabs defaultValue="members" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="chat">Clan Chat</TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <ClanMemberList members={members} />
              </TabsContent>

              <TabsContent value="chat">
                <ChatPanel
                  channelType="clan"
                  channelId={clan.id}
                  title="Clan Chat"
                  className="min-h-[400px]"
                />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Tabs defaultValue="create" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="create">Create Clan</TabsTrigger>
              <TabsTrigger value="browse">Browse Clans</TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              <CreateClanForm onCreate={createClan} />
            </TabsContent>

            <TabsContent value="browse">
              <ClanBrowser onSearch={searchClans} onJoin={joinClan} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
