import type { AgentTool } from "./types";

export const webSearchTool: AgentTool = {
  definition: {
    name: "web_search",
    description: "Search the web for current information, documentation, news, or any public content. Returns a text summary of relevant results.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" }
      },
      required: ["query"]
    }
  },

  async execute(input) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query) return "Error: query is required";

    const braveKey = process.env.BRAVE_SEARCH_API_KEY;
    if (braveKey) {
      try {
        const res = await fetch(
          `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
          { headers: { "Accept": "application/json", "X-Subscription-Token": braveKey } }
        );
        if (!res.ok) throw new Error(`Brave API ${res.status}`);
        const data = await res.json() as {
          web?: { results?: Array<{ title?: string; description?: string; url?: string }> }
        };
        const results = data.web?.results ?? [];
        if (!results.length) return "No results found.";
        return results
          .map((r, i) => `${i + 1}. **${r.title ?? "Untitled"}**\n${r.description ?? ""}\n${r.url ?? ""}`)
          .join("\n\n");
      } catch (err) {
        return `Search error: ${String(err)}`;
      }
    }

    // Fallback: DuckDuckGo instant answers (no API key required)
    try {
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      if (!res.ok) return `Search unavailable (${res.status}). Set BRAVE_SEARCH_API_KEY for full web search.`;
      const data = await res.json() as {
        AbstractText?: string;
        AbstractURL?: string;
        RelatedTopics?: Array<{ Text?: string }>;
      };
      const parts: string[] = [];
      if (data.AbstractText) parts.push(`${data.AbstractText}\n${data.AbstractURL ?? ""}`);
      for (const t of (data.RelatedTopics ?? []).slice(0, 4)) {
        if (t.Text) parts.push(`- ${t.Text}`);
      }
      if (!parts.length) return `No instant results for "${query}". Set BRAVE_SEARCH_API_KEY for full web search.`;
      return parts.join("\n\n");
    } catch {
      return "Search unavailable. Set BRAVE_SEARCH_API_KEY to enable web search.";
    }
  }
};
