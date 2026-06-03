import { Book, Link } from "@/types";

const OL = "https://covers.openlibrary.org/b/isbn";

export const navLinks: Link[] = [
  {
    name: "Library",
    url: "/",
  },
  {
    name: "Add New",
    url: "/new-book",
  },
];

export const bookSamples: Book[] = [
  {
    id: 1,
    name: "Clean Code",
    author: "Robert Cecil Martin",
    imageUrl: `${OL}/9780132350884-L.jpg`,
  },
  {
    id: 2,
    name: "JavaScript: The Definitive Guide",
    author: "David Flanagan",
    imageUrl: `${OL}/9781491952023-L.jpg`,
  },
  {
    id: 3,
    name: "Brave New World",
    author: "Aldous Huxley",
    imageUrl: `${OL}/9780060929879-L.jpg`,
  },
  {
    id: 4,
    name: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    imageUrl: `${OL}/9781612680194-L.jpg`,
  },
  {
    id: 5,
    name: "Deep Work",
    author: "Cal Newport",
    imageUrl: `${OL}/9781455586691-L.jpg`,
  },
];

export const howItWorks = [
  { number: 1, title: "Upload PDF", description: "Add your book file" },
  { number: 2, title: "AI Processing", description: "We analyze the content" },
  { number: 3, title: "Voice Chat", description: "Discuss with AI" },
];

export type Voice = {
  id: string;
  name: string;
  description: string;
};

export const maleVoices: Voice[] = [
  {
    id: "dave",
    name: "Dave",
    description: "Young male, British-Essex, casual & conversational",
  },
  {
    id: "daniel",
    name: "Daniel",
    description: "Middle-aged male, British, authoritative but warm",
  },
  { id: "chris", name: "Chris", description: "Male, casual & easy-going" },
];

export const femaleVoices: Voice[] = [
  {
    id: "rachel",
    name: "Rachel",
    description: "Young female, American, calm & clear",
  },
  {
    id: "sarah",
    name: "Sarah",
    description: "Young female, American, soft & approachable",
  },
];
