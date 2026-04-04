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
  description: "AI-powered road trip planning powered by Claude",
};

const themeScript = `(function(){try{
  var d=document.documentElement;
  if(localStorage.getItem('dark-mode')==='true')d.classList.add('dark');
  var seasons=['spring','summer','autumn','winter'];
  var saved=localStorage.getItem('season');
  if(!saved){var m=new Date().getMonth();saved=m>=2&&m<=4?'spring':m>=5&&m<=7?'summer':m>=8&&m<=10?'autumn':'winter';}
  seasons.forEach(function(s){d.classList.remove('theme-'+s);});
  d.classList.add('theme-'+saved);
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
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
