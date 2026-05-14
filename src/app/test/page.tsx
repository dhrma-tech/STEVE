import { ChatTester } from "@/components/ai/chat-tester";

export default function TestPage() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center gap-8 p-8"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <div className="w-full" style={{ maxWidth: "672px" }}>
        <h1 className="text-2xl font-medium tracking-[0px]">Claude API Test</h1>
        <p className="mt-1 text-sm text-[var(--foreground-50)]">
          Verify your Anthropic API key works end-to-end on localhost.
        </p>
      </div>
      <ChatTester />
    </main>
  );
}
