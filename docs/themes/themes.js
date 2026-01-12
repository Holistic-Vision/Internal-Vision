export const THEMES = [
  { id:"armor",  label:"ARMOR",  accent:"#fb923c", accent2:"#fbbf24" },
  { id:"jarvis", label:"JARVIS", accent:"#4fd1c5", accent2:"#60a5fa" },
  { id:"shield", label:"SHIELD", accent:"#34d399", accent2:"#22c55e" }
];

export function applyTheme(themeId){
  const html=document.documentElement;
  html.dataset.theme = themeId;
}
