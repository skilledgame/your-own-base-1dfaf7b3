import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, MessageCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DesktopSideMenu } from '@/components/DesktopSideMenu';
import { FriendsList } from '@/components/friends/FriendsList';
import { FriendSearch } from '@/components/friends/FriendSearch';
import { FriendRequests } from '@/components/friends/FriendRequests';
import { InviteToGameModal } from '@/components/friends/InviteToGameModal';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { getDmChannelId } from '@/stores/chatStore';
import { useAuth } from '@/contexts/AuthContext';
import { useFriends } from '@/hooks/useFriends';
import { useFriendStore, type Friend } from '@/stores/friendStore';
import skilledLogo from '@/assets/skilled-logo.png';

export default function Friends() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [chatFriendId, setChatFriendId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('friends');

  const {
    friends,
    incomingRequests,
    outgoingRequests,
    pendingCount,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    inviteToGame,
  } = useFriends();

  const initialize = useFriendStore(state => state.initialize);

  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      navigate('/auth');
      return;
    }
    if (user?.id) {
      initialize(user.id);
    }
  }, [isAuthReady, isAuthenticated, user?.id, navigate, initialize]);

  const handleInviteToGame = (userId: string) => {
    const friend = friends.find(f => f.friend_user_id === userId);
    if (friend) {
      setSelectedFriend(friend);
      setInviteModalOpen(true);
    }
  };

  const handleOpenChat = (userId: string) => {
    setChatFriendId(userId);
  };

  const chatFriend = friends.find(f => f.friend_user_id === chatFriendId);
  const dmChannelId = user && chatFriendId ? getDmChannelId(user.id, chatFriendId) : null;

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
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Friends</h1>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {chatFriendId && dmChannelId ? (
          <div className="space-y-4">
            <button
              onClick={() => setChatFriendId(null)}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              &larr; Back to friends
            </button>
            <ChatPanel
              channelType="dm"
              channelId={dmChannelId}
              title={`Chat with ${chatFriend?.display_name || 'Friend'}`}
              className="min-h-[500px]"
            />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-muted">
              <TabsTrigger value="friends" className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                Friends
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                  {friends.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="requests" className="flex items-center gap-1.5 relative">
                <UserPlus className="w-4 h-4" />
                Requests
                {pendingCount > 0 && (
                  <Badge className="ml-1 text-[10px] h-4 px-1 bg-red-500 text-white">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="search" className="flex items-center gap-1.5">
                <Search className="w-4 h-4" />
                Search
              </TabsTrigger>
            </TabsList>

            <TabsContent value="friends">
              <FriendsList
                friends={friends}
                loading={loading}
                onRemoveFriend={removeFriend}
                onInviteToGame={handleInviteToGame}
                onOpenChat={handleOpenChat}
              />
            </TabsContent>

            <TabsContent value="requests">
              <FriendRequests
                incoming={incomingRequests}
                outgoing={outgoingRequests}
                onAccept={acceptRequest}
                onDecline={declineRequest}
              />
            </TabsContent>

            <TabsContent value="search">
              <FriendSearch
                onSendRequest={sendRequest}
                existingFriendIds={friends.map(f => f.friend_user_id)}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <InviteToGameModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        friend={selectedFriend}
        onInvite={inviteToGame}
      />

      <MobileBottomNav onMenuClick={() => setSideMenuOpen(true)} />
    </div>
  );
}
