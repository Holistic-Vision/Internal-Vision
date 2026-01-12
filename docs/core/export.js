export function download(filename, text, mime="text/plain"){
  const blob=new Blob([text], {type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

export function toCSV(rows){
  const esc=(v)=>{const s=String(v??""); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
  const headers=Object.keys(rows[0]||{});
  const lines=[headers.map(esc).join(",")];
  for(const r of rows) lines.push(headers.map(h=>esc(r[h])).join(","));
  return lines.join("\n");
}
