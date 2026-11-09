const normal=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
const validId=value=>/^UC[A-Za-z0-9_-]{22}$/.test(value||'');
export function artistBlocked(item,rules=[]){
  if(item.source==='podcast'||item.kind==='episode')return false;
  const ids=new Set([...(item.artistIds||[]),...(item.artistEntities||[]).map(artist=>artist.id)].filter(validId));
  if(ids.size)return rules.some(rule=>ids.has(rule.id));
  const names=new Set([...(item.artists||[]),item.artist||'',...(!item.artists?.length?String(item.artist||'').split(', '):[])].map(normal));
  return rules.some(rule=>rule.name&&names.has(normal(rule.name)));
}
