import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RoadAI — Plan Your Road Trip",
  description: "AI-powered road trip planning",
};

const ALL_THEMES = [
  "spring","summer","autumn","winter",
  "happy","joyful","hot","quirky",
  "anime","kpop","indian","mideast","viking","african",
];

const DARK_BG_THEMES = ["anime","hot","indian","mideast","viking"];

// Applies theme class to <html> so React never touches it on hydration
// We use html[data-theme] attribute + CSS [data-theme=summer] selectors
// But to keep CSS as body.t-*, we patch via a script that runs before paint
// and the ThemeSwitcher re-applies on client.
const themeScript = `(function(){try{
  var ALL=${JSON.stringify(ALL_THEMES)};
  var DARK=${JSON.stringify(DARK_BG_THEMES)};
  var saved=localStorage.getItem('season');
  if(!saved){var m=new Date().getMonth();saved=m>=2&&m<=4?'spring':m>=5&&m<=7?'summer':m>=8&&m<=10?'autumn':'winter';}
  var userDark=localStorage.getItem('dark-mode')==='true';
  if(userDark||DARK.indexOf(saved)!==-1)document.documentElement.classList.add('dark');
  ALL.forEach(function(t){document.documentElement.classList.remove('theme-'+t);});
  document.documentElement.setAttribute('data-theme',saved);
  document.documentElement.classList.add('theme-'+saved);
}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Pacifico&family=Space+Grotesk:wght@400;600;700&family=Syne:wght@700;800&family=Noto+Serif+Devanagari:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
