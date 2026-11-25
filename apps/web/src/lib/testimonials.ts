/// What shop owners told us after trying Veriga, in their own words.
/// To add one, put a new entry at the top. Keep the quote as they said it.
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  date: string; // YYYY-MM-DD
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Wow, I love this app",
    name: "Elico Stores",
    role: "Shop owner",
    date: "2026-11-25",
  },
  {
    quote: "This app is a game changer for my business and I'm definitely going to start using it, no more fear of my workers stealing from me. I highly recommend it to shop owners.",
    name: "Silverglam",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "It really run smoothly, easy to navigate, well built.",
    name: "Running City",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "Cool and well built app.",
    name: "Ogbonna Shopping",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "What a wonderful app, that helps small shops to get loans easily. I recommend this for everyone, especially the small business owners.",
    name: "Amaka",
    role: "Amaka's shop",
    date: "2026-11-24",
  },
  {
    quote: "The app is nice, I highly recommend it.",
    name: "DeeBbest Stores",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "The app is really nice and user explanatory. And it also responds fast.",
    name: "Vickman",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "This is beautiful my dear, I love it. Very fast and swift. Nice one.",
    name: "Mama Chisom",
    role: "Shop owner",
    date: "2026-11-24",
  },
  {
    quote: "So fast and swift. This is good, man.",
    name: "Patrick",
    role: "Patrick Store",
    date: "2026-11-24",
  },
];
