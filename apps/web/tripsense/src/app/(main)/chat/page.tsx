import { redirect } from "next/navigation";

export default function ChatPage() {
  redirect("/community?composer=trip");
}
