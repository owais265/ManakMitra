import { createFileRoute } from "@tanstack/react-router";
import ChatBotApp from "@/components/manakmitra-chat";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  return <ChatBotApp />;
}
