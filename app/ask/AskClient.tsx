"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TripPersona } from "@/app/chat/personaConfig";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

interface PromptCard {
  icon: string;
  title: string;
  prompt: string;
}

interface Section {
  heading: string;
  cards: PromptCard[];
}

// ── Persona-matched sections ────────────────────────────────────────────────

const SECTIONS_BY_PERSONA: Record<string, Section[]> = {
  solo: [
    {
      heading: "🧳 Solo Adventures",
      cards: [
        { icon: "🗺️", title: "Hidden Gems", prompt: "I'm travelling solo. Find me hidden gems and lesser-known attractions that most tourists miss — the kind of places locals love." },
        { icon: "🛣️", title: "Scenic Byways", prompt: "Suggest the most scenic solo road trip routes in the US — minimal traffic, stunning views, great for a solo driver." },
        { icon: "🏕️", title: "Solo Camping Spots", prompt: "Find me safe and beautiful camping spots perfect for a solo traveller — with facilities, cell coverage, and things to do nearby." },
      ],
    },
    {
      heading: "💸 Budget & Planning",
      cards: [
        { icon: "💰", title: "Budget Road Trip", prompt: "Plan a budget-friendly road trip for a solo traveller — cheap eats, free attractions, affordable accommodation options." },
        { icon: "📅", title: "Weekend Escape", prompt: "I have a free weekend. Suggest a quick solo road trip I can do in 2 days — leaving Friday evening and back by Sunday night." },
        { icon: "⛽", title: "Fuel & Rest Stops", prompt: "What are the best fuel and rest stop strategies for a solo long-distance road trip? Tips on staying alert and finding good spots." },
      ],
    },
  ],

  couple: [
    {
      heading: "💑 Romantic Drives",
      cards: [
        { icon: "🌅", title: "Sunset Viewpoints", prompt: "Find the most romantic sunset viewpoints along a road trip route — cliffside lookouts, lakeside spots, and scenic overlooks perfect for two." },
        { icon: "🍷", title: "Wine Country Route", prompt: "Plan a romantic road trip through wine country — vineyard stops, cosy B&Bs, and candlelit dinner recommendations." },
        { icon: "🏨", title: "Cosy Stays", prompt: "Suggest charming boutique hotels and B&Bs along a scenic road trip route — romantic, intimate, and highly rated." },
      ],
    },
    {
      heading: "🎯 Experiences Together",
      cards: [
        { icon: "🌊", title: "Coastal Escape", prompt: "Plan a romantic coastal road trip for two — sea views, fresh seafood, quiet beaches, and stunning cliff walks." },
        { icon: "🏔️", title: "Mountain Retreat", prompt: "Suggest a couples mountain road trip — cosy cabins, hiking trails with great views, and hot springs." },
        { icon: "🎭", title: "Culture & Food", prompt: "Plan a culturally rich road trip for two — art towns, food markets, local festivals, and must-visit restaurants." },
      ],
    },
  ],

  family: [
    {
      heading: "👨‍👩‍👧‍👦 Family Road Trips",
      cards: [
        { icon: "🏞️", title: "National Parks", prompt: "Plan a family road trip visiting national parks — kid-friendly trails, ranger programs, campgrounds, and the best parks for children." },
        { icon: "🎢", title: "Kid-Friendly Stops", prompt: "Find the best kid-friendly road trip stops — theme parks, children's museums, zoos, water parks, and fun roadside attractions." },
        { icon: "🌮", title: "Family Dining", prompt: "Suggest family-friendly restaurants along a road trip route — good kids menus, quick service, and places kids actually enjoy." },
      ],
    },
    {
      heading: "🚗 Keep Everyone Happy",
      cards: [
        { icon: "🛑", title: "Best Rest Stops", prompt: "What are the best rest stops and service areas for families on a long road trip? Playgrounds, clean facilities, and good food options." },
        { icon: "🎮", title: "Road Trip Games", prompt: "Give me a list of road trip games and activities to keep kids entertained on a long drive — both screen and screen-free options." },
        { icon: "🏖️", title: "Beach Family Trip", prompt: "Plan a family beach road trip — calm swimming beaches, lifeguarded areas, beachside accommodation, and activities for all ages." },
      ],
    },
  ],

  friends: [
    {
      heading: "🎉 Group Adventures",
      cards: [
        { icon: "🤘", title: "Epic Route", prompt: "Plan an epic road trip for a group of friends — iconic routes, must-stop towns, adventure activities, and legendary roadside spots." },
        { icon: "🎵", title: "Music Festival Route", prompt: "Build a road trip around music festivals — the best festivals happening this season, with routes connecting them and camping options." },
        { icon: "🏄", title: "Adventure Activities", prompt: "Find the best adventure activities along a road trip route for a group of friends — surfing, white water rafting, hiking, skydiving." },
      ],
    },
    {
      heading: "🍻 Eat, Drink & Explore",
      cards: [
        { icon: "🍺", title: "Craft Brewery Trail", prompt: "Plan a road trip through the best craft breweries — highly rated taprooms, brewery towns, and beer trail routes." },
        { icon: "🌃", title: "City Nights", prompt: "Suggest the best cities to stop in on a road trip for nightlife, live music, great bars, and late-night food." },
        { icon: "📸", title: "Most Instagrammable", prompt: "Find the most photogenic and Instagrammable road trip stops — colourful towns, surreal landscapes, iconic signs, and unique roadside art." },
      ],
    },
  ],

  work: [
    {
      heading: "💼 Work Trip Planning",
      cards: [
        { icon: "🏨", title: "Business Hotels", prompt: "Find highly rated business hotels along my route — reliable WiFi, work desks, meeting rooms, and breakfast included." },
        { icon: "☕", title: "Work-Friendly Cafés", prompt: "Suggest the best work-friendly cafés along my route — strong WiFi, power outlets, quiet atmosphere, and good coffee." },
        { icon: "🚗", title: "Efficient Route", prompt: "Plan the most efficient driving route between my business stops — minimising drive time, accounting for traffic, and good rest breaks." },
      ],
    },
    {
      heading: "⚡ Downtime Between Meetings",
      cards: [
        { icon: "🏃", title: "Quick Activities", prompt: "What are the best quick activities I can do between business meetings on a road trip — walks, viewpoints, great lunch spots, under 2 hours." },
        { icon: "🍽️", title: "Client Dinner Spots", prompt: "Find highly rated restaurants suitable for a client dinner along my route — professional atmosphere, great food, private dining options." },
        { icon: "🧘", title: "Recharge Stops", prompt: "Suggest the best places to recharge on a long work road trip — hotel gyms, spas, green spaces, and good sleep." },
      ],
    },
  ],

  meetup: [
    {
      heading: "🤝 Find Meetup Venues",
      cards: [
        { icon: "☕", title: "Café Spots", prompt: "Find quiet cafés perfect for a 2-hour meetup — good WiFi, comfortable seating, not too noisy, and accessible by public transport." },
        { icon: "💻", title: "Co-working Spaces", prompt: "Suggest co-working spaces and shared offices available for a day pass — good for a professional meeting or focused work session." },
        { icon: "🏨", title: "Hotel Lobbies", prompt: "Find hotel lobbies suitable for a professional meetup — comfortable seating areas, available to non-guests, central location." },
      ],
    },
    {
      heading: "📍 By Vibe",
      cards: [
        { icon: "📚", title: "Quiet & Focused", prompt: "I need a very quiet venue for a focused work meeting — libraries, private café corners, or silent co-working spaces." },
        { icon: "🌿", title: "Casual & Relaxed", prompt: "Find casual, relaxed spots for an informal meetup — garden cafés, relaxed wine bars, or low-key brunch places." },
        { icon: "🎯", title: "Central & Easy to Find", prompt: "Suggest central, easy-to-find meetup spots with good transport links — ideal for people coming from different directions." },
      ],
    },
  ],

  default: [
    {
      heading: "🌟 Popular Starters",
      cards: [
        { icon: "💎", title: "Hidden Gems", prompt: "I want to explore hidden gems on a road trip. Find me lesser-known towns, secret viewpoints, and offbeat attractions that locals love." },
        { icon: "🏙️", title: "Top Towns & Cities", prompt: "What are the best towns and cities to stop at on a US road trip? Recommend places with great food, history, and things to do." },
        { icon: "🗓️", title: "Plan My Escape", prompt: "I have 5 days free. Plan me a road trip escape — interesting route, great stops, mix of nature and culture." },
      ],
    },
    {
      heading: "🍽️ Food & Culture",
      cards: [
        { icon: "🌮", title: "Foodie Road Trip", prompt: "Plan a road trip centred around food — the best roadside diners, local food markets, farm-to-table restaurants, and regional specialities." },
        { icon: "🏞️", title: "National Parks Loop", prompt: "Plan a national parks road trip loop — the best parks to visit, scenic drives between them, and campground recommendations." },
        { icon: "📸", title: "Most Scenic Routes", prompt: "What are the most scenic road trip routes in the US? I want stunning views, great photo spots, and memorable drives." },
      ],
    },
    {
      heading: "⚡ Quick Trips",
      cards: [
        { icon: "🌅", title: "Perfect Weekend", prompt: "Plan a perfect weekend road trip — leaving Friday after work, back by Sunday night. Somewhere within 3 hours drive that's worth it." },
        { icon: "🏖️", title: "Beach Getaway", prompt: "Find the best beach road trip route — great swimming beaches, seafood restaurants, and coastal towns with character." },
        { icon: "❄️", title: "5 Days, Zero Regrets", prompt: "I've got 5 days and I want zero regrets. Hit me with an unforgettable road trip itinerary — part adventure, part culture, part food." },
      ],
    },
  ],
};

function getSections(persona: TripPersona | null): Section[] {
  if (!persona?.travelling_as) return SECTIONS_BY_PERSONA.default;
  return SECTIONS_BY_PERSONA[persona.travelling_as] ?? SECTIONS_BY_PERSONA.default;
}

export default function AskClient({ userEmail }: { userEmail: string }) {
  const [input, setInput] = useState("");
  const [persona, setPersona] = useState<TripPersona | null>(null);
  const router = useRouter();

  // Load most recent persona from last conversation
  useEffect(() => {
    if (!userEmail) return;
    fetch(`${BACKEND}/conversations?user_email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then(async (convs) => {
        if (!convs.length) return;
        const latest = convs[0];
        const res = await fetch(`${BACKEND}/conversations/${latest.id}`);
        const data = await res.json();
        const p = data.persona as TripPersona;
        if (p?.travelling_as) setPersona(p);
      })
      .catch(() => {});
  }, [userEmail]);

  function startChat(prompt: string) {
    if (!prompt.trim()) return;
    router.push(`/chat?prompt=${encodeURIComponent(prompt.trim())}`);
  }

  const sections = getSections(persona);
  const personaLabel = persona?.travelling_as
    ? { solo: "Solo", couple: "Couple", family: "Family", friends: "Friends", work: "Work Trip", meetup: "Meetup" }[persona.travelling_as]
    : null;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto h-[calc(100vh-56px)]" style={{ backgroundColor: "var(--t-bg, #f9fafb)" }}>

      {/* Hero input */}
      <div className="px-6 pt-10 pb-6 max-w-3xl mx-auto w-full">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Ask RoadAI</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Start with a prompt below{personaLabel ? ` — tailored for ${personaLabel} trips` : ""}, or type your own.
        </p>

        {/* Search box */}
        <div
          className="flex items-end gap-3 rounded-2xl border-2 p-4 shadow-sm transition-all focus-within:shadow-md"
          style={{ borderColor: "var(--t-primary)", background: "white" }}
        >
          <textarea
            className="flex-1 resize-none outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent leading-relaxed"
            placeholder="Ask anything about your road trip… e.g. Plan a 3-day trip from Austin to New Orleans"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); startChat(input); }
            }}
          />
          <button
            onClick={() => startChat(input)}
            disabled={!input.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 shrink-0"
            style={{ background: "var(--t-primary)" }}
          >
            Go
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>

        {/* Persona badge */}
        {personaLabel && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">Suggestions tailored for:</span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: "var(--t-primary-light)", color: "var(--t-primary)" }}
            >
              {personaLabel}
            </span>
            <button
              onClick={() => setPersona(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Show all
            </button>
          </div>
        )}
      </div>

      {/* Prompt sections */}
      <div className="px-6 pb-12 max-w-3xl mx-auto w-full flex flex-col gap-8">
        {sections.map((section) => (
          <div key={section.heading}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">{section.heading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {section.cards.map((card) => (
                <button
                  key={card.title}
                  onClick={() => { setInput(card.prompt); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="text-left p-4 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[var(--t-primary)] hover:shadow-md transition-all group"
                >
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[var(--t-primary)] transition-colors mb-1">
                    {card.title}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2">
                    {card.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
