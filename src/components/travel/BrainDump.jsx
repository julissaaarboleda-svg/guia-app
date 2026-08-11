import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Mic, Sparkles, X, Loader2, RefreshCw } from "lucide-react";

export default function BrainDump({ trip, onOrganized }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let final = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += transcript + " ";
          else interimText += transcript;
        }
        if (final) setText(prev => (prev + " " + final).trim());
        setInterim(interimText);
      };
      rec.onend = () => { setRecording(false); setInterim(""); };
      rec.onerror = () => { setRecording(false); setInterim(""); };
      recognitionRef.current = rec;
    }
    return () => { try { recognitionRef.current?.stop(); } catch {} };
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) return;
    if (recording) {
      recognitionRef.current.stop();
      setRecording(false);
    } else {
      try { recognitionRef.current.start(); setRecording(true); } catch {}
    }
  };

  const organize = async () => {
    if (!text.trim()) return;
    setOrganizing(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are organizing a traveler's free-form brain dump into structured recap sections for a trip to ${trip.country || trip.title || "their destination"}.

Here is what the traveler wrote/dictated:

"""
${text}
"""

Parse this into structured sections:
- "summary": 2-4 paragraphs of polished first-person prose. Use simple HTML (<p>, <br>, <strong>, <em>). Only include content actually present.
- "lessons_learned": 1-3 paragraphs of polished first-person prose. Use simple HTML. If none, return empty string.
- "highlights": Array of {text, checked: false}. Memorable moments, favorite experiences, standout people. Concise phrases. If none, return empty array.
- "places_to_visit": Array of {text}. Places/activities they mentioned wanting to do but didn't, or want to try next time. If none, return empty array.
- "prep_checklist": Array of {text, checked: false}. Actionable tasks — BOTH immediate post-trip items (e.g., "Email hotel about lost jacket") AND prep for next time (e.g., "Bring more cash", "Research card-friendly spots"). If none, return empty array.

Be faithful to the traveler's content. Polish but don't fabricate.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            lessons_learned: { type: "string" },
            highlights: { type: "array", items: { type: "object", properties: { text: { type: "string" }, checked: { type: "boolean" } } } },
            places_to_visit: { type: "array", items: { type: "object", properties: { text: { type: "string" } } } },
            prep_checklist: { type: "array", items: { type: "object", properties: { text: { type: "string" }, checked: { type: "boolean" } } } },
          },
        },
      });

      const existing = trip.recap || {};
      const merged = {
        summary: res.summary || existing.summary || "",
        lessons_learned: res.lessons_learned || existing.lessons_learned || "",
        highlights: [...(res.highlights || []), ...(existing.highlights || [])],
        places_to_visit: [...(res.places_to_visit || []), ...(existing.places_to_visit || [])],
        prep_checklist: [...(res.prep_checklist || []), ...(existing.prep_checklist || []), ...(existing.return_todo || [])],
      };
      const updated = await base44.entities.Trip.update(trip.id, { recap: merged });
      onOrganized(updated);
      setText("");
    } catch (e) {
      console.error(e);
    }
    setOrganizing(false);
  };

  const reExtract = async () => {
    const existing = trip.recap || {};
    const sourceText = ((existing.summary || "") + " " + (existing.lessons_learned || "")).replace(/<[^>]*>/g, " ").trim();
    if (!sourceText) return;
    setReExtracting(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are extracting structured lists from a traveler's existing trip recap. The trip was to ${trip.country || trip.title || "their destination"}.

Here is the existing recap content (summary + lessons):

"""
${sourceText}
"""

Extract into these lists. Only include items actually mentioned in the text:
- "highlights": Array of {text, checked: false}. Memorable moments, favorite experiences, standout people mentioned.
- "places_to_visit": Array of {text}. Places/activities they wanted to do but didn't, or want to try next time.
- "prep_checklist": Array of {text, checked: false}. Actionable tasks — both immediate post-trip items and prep for next time.

If a category has nothing in the text, return an empty array. Do not fabricate.`,
        response_json_schema: {
          type: "object",
          properties: {
            highlights: { type: "array", items: { type: "object", properties: { text: { type: "string" }, checked: { type: "boolean" } } } },
            places_to_visit: { type: "array", items: { type: "object", properties: { text: { type: "string" } } } },
            prep_checklist: { type: "array", items: { type: "object", properties: { text: { type: "string" }, checked: { type: "boolean" } } } },
          },
        },
      });

      const merged = {
        ...existing,
        highlights: [...(res.highlights || []), ...(existing.highlights || [])],
        places_to_visit: [...(res.places_to_visit || []), ...(existing.places_to_visit || [])],
        prep_checklist: [...(res.prep_checklist || []), ...(existing.prep_checklist || []), ...(existing.return_todo || [])],
      };
      const updated = await base44.entities.Trip.update(trip.id, { recap: merged });
      onOrganized(updated);
    } catch (e) {
      console.error(e);
    }
    setReExtracting(false);
  };

  const hasExistingRecap = (trip.recap?.summary || trip.recap?.lessons_learned)?.replace(/<[^>]*>/g, "").trim();

  return (
    <div className="bg-foreground text-background rounded-2xl p-5 border border-foreground">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4" />
        <h3 className="font-heading text-sm font-medium">Brain Dump</h3>
      </div>
      <p className="text-xs text-background/60 mb-3 leading-relaxed">
        Type or speak freely — your raw thoughts, memories, notes. When you're done, AI will organize everything into the sections below.
      </p>

      <div className="relative">
        <textarea
          value={text + (interim ? " " + interim : "")}
          onChange={e => setText(e.target.value)}
          placeholder="Just start writing or talking... the food was incredible. Wish I'd brought more cash. The salsa night was unreal. Need to email the hostel about the jacket I left. Next time I want to check out the museums..."
          rows={6}
          className="w-full bg-background/10 border border-background/20 rounded-xl px-4 py-3 text-sm text-background placeholder:text-background/40 outline-none focus:border-background/40 transition-colors resize-none"
          disabled={organizing}
        />
        {text && !organizing && (
          <button onClick={() => setText("")} className="absolute top-2 right-2 text-background/40 hover:text-background transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {voiceSupported && (
          <button
            onClick={toggleRecording}
            disabled={organizing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${recording ? "bg-red-500 text-white" : "bg-background/10 text-background hover:bg-background/20"}`}
          >
            <Mic className="w-3.5 h-3.5" />
            {recording ? "Stop" : "Dictate"}
          </button>
        )}
        <button
          onClick={organize}
          disabled={!text.trim() || organizing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-background text-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
        >
          {organizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {organizing ? "Organizing..." : "Organize"}
        </button>
      </div>

      {hasExistingRecap && (
        <button
          onClick={reExtract}
          disabled={reExtracting}
          className="w-full flex items-center justify-center gap-1.5 mt-3 py-2 rounded-lg text-xs font-medium bg-background/10 text-background hover:bg-background/20 transition-colors disabled:opacity-40"
        >
          {reExtracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {reExtracting ? "Re-extracting..." : "Re-extract lists from existing recap"}
        </button>
      )}
    </div>
  );
}