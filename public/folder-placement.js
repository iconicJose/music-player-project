const parent=path=>path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
export function folderPlacement(body,revision){
  if(!['rename-folder','move-folder','delete-folder'].includes(body?.action)||typeof body.folder!=='string'||!body.folder)return null;
  const from=body.folder,to=body.action==='rename-folder'?[parent(from),String(body.name||'').trim()].filter(Boolean).join('/'):body.action==='move-folder'?[body.parent||'',from.split('/').at(-1)].filter(Boolean).join('/'):parent(from);
  return from===to?null:{from,to,deleted:body.action==='delete-folder',...(Number.isSafeInteger(revision)&&revision>=0?{revision}:{})};
}
export function placedFolder(path,change){
  if(!change||typeof path!=='string')return path;
  if(path===change.from)return change.to;
  if(!path.startsWith(change.from+'/'))return path;
  return [change.to,path.slice(change.from.length+1)].filter(Boolean).join('/');
}
export function placedContext(context,change){
  if(!change||context?.type!=='folder'||typeof context.id!=='string')return context;
  if(Number.isSafeInteger(change.revision)&&Number.isSafeInteger(context.folderRevision)&&context.folderRevision>=change.revision)return context;
  if(change.deleted&&context.id===change.from)return null;
  const id=placedFolder(context.id,change),version=Number.isSafeInteger(change.revision)&&change.revision>=0?{folderRevision:change.revision}:null;return id===context.id&&!version?context:{...context,...version,id,name:id};
}
export function placedPreferences(prefs,change){
  if(!change)return prefs;
  if(Number.isSafeInteger(change.revision)&&Number.isSafeInteger(prefs.folderRevision)&&prefs.folderRevision>=change.revision)return prefs;
  const key=value=>{if(!value.startsWith('folder:'))return value;const path=value.slice(7);return change.deleted&&path===change.from?null:'folder:'+placedFolder(path,change);};
  const recent={};for(const [old,stamp] of Object.entries(prefs.recent||{})){const next=key(old);if(next!==null)recent[next]=Math.max(recent[next]||0,stamp);}
  return {...prefs,...(Number.isSafeInteger(change.revision)?{folderRevision:change.revision}:{}),pins:Array.isArray(prefs.pins)?[...new Set(prefs.pins.map(key).filter(value=>value!==null))]:prefs.pins,recent};
}
