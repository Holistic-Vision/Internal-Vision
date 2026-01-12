export function canSpeak(){
  return ("speechSynthesis" in window);
}

export function speak(text, enabled=true){
  if(!enabled) return;
  if(!canSpeak()) return;
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang="fr-FR";
    u.rate=1.02;
    u.pitch=0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch{}
}
