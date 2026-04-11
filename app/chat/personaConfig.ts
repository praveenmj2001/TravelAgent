// Shared persona config used by PersonaSheet and PersonaPanel

export interface TripPersona {
  travelling_as: string;
  travel_style: string;
  trip_length: string;
  interests: string;          // comma-separated
  dietary: string;            // comma-separated
  pets: string;               // comma-separated
  meet_location: string;
  meet_time: string;
  meet_date: string;
  spontaneous_vibe: string;   // for spontaneous drive mode
}

export const EMPTY_PERSONA: TripPersona = {
  travelling_as: "",
  travel_style: "",
  trip_length: "",
  interests: "",
  dietary: "",
  pets: "",
  meet_location: "",
  meet_time: "",
  meet_date: "",
  spontaneous_vibe: "",
};

export const TRAVELLING_AS = [
  { value: "solo",         emoji: "🧳", label: "Solo" },
  { value: "couple",       emoji: "💑", label: "Couple" },
  { value: "family",       emoji: "👨‍👩‍👧‍👦", label: "Family" },
  { value: "friends",      emoji: "🎉", label: "Friends" },
  { value: "work",         emoji: "💼", label: "Work Trip" },
  { value: "meetup",       emoji: "🤝", label: "Meetup" },
  { value: "spontaneous",  emoji: "🌙", label: "Spontaneous Drive" },
];

export const SPONTANEOUS_VIBE = [
  { value: "scenic",     emoji: "🌅", label: "Scenic Drive" },
  { value: "foodie",     emoji: "🍦", label: "Food & Treats" },
  { value: "citylights", emoji: "🌆", label: "City Lights" },
  { value: "nature",     emoji: "🌿", label: "Nature & Outdoors" },
  { value: "fun",        emoji: "🎡", label: "Fun & Activities" },
  { value: "surprise",   emoji: "🎲", label: "Surprise Me" },
];

export const MEET_TIME = [
  { value: "morning",   emoji: "🌅", label: "Morning" },
  { value: "afternoon", emoji: "☀️",  label: "Afternoon" },
  { value: "evening",   emoji: "🌆", label: "Evening" },
  { value: "night",     emoji: "🌙", label: "Night" },
];

export const TRAVEL_STYLE = [
  { value: "adventure", emoji: "🏔️", label: "Adventure" },
  { value: "relaxed",   emoji: "🏖️", label: "Relaxed" },
  { value: "cultural",  emoji: "🏛️", label: "Cultural" },
  { value: "foodie",    emoji: "🍜", label: "Foodie" },
  { value: "luxury",    emoji: "✨", label: "Luxury" },
  { value: "budget",    emoji: "💰", label: "Budget" },
];

export const TRIP_LENGTH = [
  { value: "1day",     emoji: "⚡", label: "1 Day" },
  { value: "weekend",  emoji: "🌅", label: "Weekend (2-3 days)" },
  { value: "week",     emoji: "🗓️", label: "A Week" },
  { value: "twoweeks", emoji: "📅", label: "Two Weeks" },
  { value: "month",    emoji: "🌍", label: "A Month or More" },
];

export const INTERESTS = [
  { value: "nature",    emoji: "🌿", label: "Nature" },
  { value: "history",   emoji: "🏰", label: "History" },
  { value: "food",      emoji: "🍕", label: "Food & Drink" },
  { value: "nightlife", emoji: "🎵", label: "Nightlife" },
  { value: "sports",    emoji: "⚽", label: "Sports" },
  { value: "art",       emoji: "🎨", label: "Art & Culture" },
  { value: "beaches",   emoji: "🏄", label: "Beaches" },
  { value: "mountains", emoji: "⛰️", label: "Mountains" },
];

export const PETS = [
  { value: "dog",    emoji: "🐶", label: "Dog" },
  { value: "cat",    emoji: "🐱", label: "Cat" },
  { value: "bird",   emoji: "🐦", label: "Bird" },
  { value: "rabbit", emoji: "🐰", label: "Rabbit" },
  { value: "none",   emoji: "🚫", label: "No Pets" },
];

export const DIETARY = [
  { value: "veg",          emoji: "🥗", label: "Veg" },
  { value: "vegan",        emoji: "🌱", label: "Vegan" },
  { value: "nonveg",       emoji: "🍗", label: "Non-veg" },
  { value: "eggetarian",   emoji: "🥚", label: "Eggetarian" },
  { value: "pescatarian",  emoji: "🐟", label: "Pescatarian" },
  { value: "jain",         emoji: "🙏", label: "Jain" },
  { value: "halal",        emoji: "☪️",  label: "Halal" },
  { value: "kosher",       emoji: "✡️",  label: "Kosher" },
  { value: "glutenfree",   emoji: "🌾", label: "Gluten-free" },
];

// Standard trip categories
export const PERSONA_CATEGORIES = [
  { key: "travelling_as" as keyof TripPersona, label: "Travelling as",   options: TRAVELLING_AS, multi: false },
  { key: "travel_style"  as keyof TripPersona, label: "Travel Style",    options: TRAVEL_STYLE,  multi: false },
  { key: "trip_length"   as keyof TripPersona, label: "Trip Length",     options: TRIP_LENGTH,   multi: false },
  { key: "interests"     as keyof TripPersona, label: "Interests",       options: INTERESTS,     multi: true  },
  { key: "dietary"       as keyof TripPersona, label: "Dietary",         options: DIETARY,       multi: true  },
  { key: "pets"          as keyof TripPersona, label: "Travelling with Pets", options: PETS,     multi: true  },
];

// Spontaneous drive display categories (for sidebar)
export const SPONTANEOUS_DISPLAY_CATEGORIES = [
  { key: "travelling_as"    as keyof TripPersona, label: "Mode",  options: TRAVELLING_AS,    multi: false },
  { key: "spontaneous_vibe" as keyof TripPersona, label: "Vibe",  options: SPONTANEOUS_VIBE, multi: false },
];

// Meetup-specific display categories (for sidebar)
export const MEETUP_DISPLAY_CATEGORIES = [
  { key: "travelling_as" as keyof TripPersona, label: "Type",         options: TRAVELLING_AS, multi: false },
  { key: "meet_location" as keyof TripPersona, label: "Meet Location", options: [],           multi: false, text: true },
  { key: "meet_time"     as keyof TripPersona, label: "Time of Day",   options: MEET_TIME,    multi: false },
  { key: "meet_date"     as keyof TripPersona, label: "Date",          options: [],           multi: false, text: true },
];

export function lookupLabel(options: { value: string; emoji: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function lookupEmoji(options: { value: string; emoji: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.emoji ?? "";
}
