import {artistBlocked} from './artist-rules.js';
import {placedContext} from './folder-placement.js';
// Every queued occurrence has its own identity, including repeated recordings.
export class PlaybackQueue {
  constructor(){this.entries=[];this.index=-1;this.serial=0;this.context='';this.contextInfo=null;this.shuffle=false;this.blockedArtists=[];}
  entry(item,manual=false,order=0){const key=Number.isSafeInteger(this.serial+1)?'queue:'+ ++this.serial:'queue:'+crypto.randomUUID();return {key,item,manual,order};}
  get current(){return this.entries[this.index]||null;}
  get upcoming(){return this.entries.slice(this.index+1);}
  get hasNext(){return this.index+1<this.entries.length;}
  folderPlacement(change){const context=placedContext(this.contextInfo,change);if(context===this.contextInfo)return false;this.contextInfo=context;this.context=context?.name||'';return true;}
  nextItem(repeat=0){if(repeat===2)return this.current?.item||null;return this.upcoming[0]?.item||(repeat?this.entries.find(entry=>!entry.manual)?.item:null)||null;}
  start(item,list=[item],context=''){
    if(artistBlocked(item,this.blockedArtists))throw Error("This artist is blocked.");
    const pending=this.upcoming.filter(e=>e.manual&&!artistBlocked(e.item,this.blockedArtists)),valid=list.filter(x=>!x.unavailable&&!artistBlocked(x,this.blockedArtists));
    let index=valid.indexOf(item);
    if(index<0&&item.entryKey)index=valid.findIndex(x=>x.entryKey===item.entryKey&&x.source===item.source&&x.id===item.id);
    if(index<0){valid.unshift(item);index=0;}
    this.entries=valid.map((value,i)=>this.entry(value,false,i));this.index=index;this.contextInfo=context&&typeof context==='object'?{...context}:null;this.context=this.contextInfo?String(context.name||''):String(context||'');
    this.entries.splice(index+1,0,...pending);
    if(this.shuffle)this.arrange(true);
    return this.current;
  }
  extendContext(prefix,items,random=Math.random){
    const context=this.entries.filter(entry=>!entry.manual);
    const keys=new Set(prefix.map(entry=>entry.key));
    if(!prefix.length||!context.length||context[0].key!==prefix[0].key||context.some(entry=>!keys.has(entry.key)))return false;
    const valid=items.filter(item=>!item.unavailable&&!artistBlocked(item,this.blockedArtists));
    // Validate the original source prefix, including any occurrences the user
    // has since removed or moved. Append only new songs; retain those edits.
    if(valid.length<prefix.length||prefix.some((entry,index)=>entry.source!==valid[index].source||entry.id!==valid[index].id))return false;
    const added=valid.slice(prefix.length).map((item,index)=>this.entry(item,false,prefix.length+index));
    if(this.shuffle)for(let i=added.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[added[i],added[j]]=[added[j],added[i]];}
    this.entries.push(...added);
    return true;
  }
  add(item){return this.addMany([item])[0]||null;}
  addMany(items){const entries=items.filter(item=>!item.unavailable&&!artistBlocked(item,this.blockedArtists)).map(item=>this.entry(item,true));let index=this.index+1;while(this.entries[index]?.manual||this.entries[index]?.queued===true)index++;this.entries.splice(index,0,...entries);return entries;}
  artistPolicy(rules=[]){this.blockedArtists=rules;const current=this.current,eligible=this.entries.filter(entry=>!artistBlocked(entry.item,rules));if(!current){this.entries=eligible;return false;}const next=this.entries.slice(this.index).find(entry=>!artistBlocked(entry.item,rules));if(!next){this.entries=[];this.index=-1;return true;}this.entries=eligible;this.index=eligible.findIndex(entry=>entry.key===next.key);for(const entry of this.entries.slice(0,this.index+1))delete entry.queued;return current.key!==this.current.key;}
  nextEntry(repeat=false,allowed=()=>true){return this.upcoming.find(entry=>allowed(entry.item))||(repeat?this.entries.find(entry=>!entry.manual&&allowed(entry.item)):null)||null;}
  next(repeat=false,allowed=()=>true){const next=this.nextEntry(repeat,allowed);if(!next)return null;this.index=this.entries.indexOf(next);for(const entry of this.entries.slice(0,this.index+1))delete entry.queued;return this.current;}
  previous(allowed=()=>true){for(let index=this.index-1;index>=0;index--)if(allowed(this.entries[index].item)){this.index=index;return this.current;}return this.current&&allowed(this.current.item)?this.current:null;}

  jump(key){const index=this.entries.findIndex(e=>e.key===key);if(index<0)return null;this.index=index;for(const entry of this.entries.slice(0,index+1))delete entry.queued;return this.current;}
  remove(keys){const removed=new Set(keys);this.entries=this.entries.filter((e,i)=>i<=this.index||!removed.has(e.key));}
  reorder(keys){const upcoming=this.upcoming,byKey=new Map(upcoming.map(e=>[e.key,e]));if(keys.length!==upcoming.length||new Set(keys).size!==keys.length||keys.some(key=>!byKey.has(key)))throw Error('The queue has changed. Reopen it.');const ordered=keys.map(key=>byKey.get(key));let order=this.entries.slice(0,this.index+1).filter(e=>!e.manual).length;for(const entry of ordered)if(!entry.manual)entry.order=order++;this.entries.splice(this.index+1,upcoming.length,...ordered);}
  move(keys,index){const chosen=new Set(keys),group=this.upcoming.filter(e=>chosen.has(e.key)),rest=this.upcoming.filter(e=>!chosen.has(e.key));rest.splice(Math.max(0,Math.min(rest.length,index)),0,...group);this.reorder(rest.map(e=>e.key));}
  moveUp(keys){const chosen=new Set(keys);for(const entry of this.upcoming)if(chosen.has(entry.key))entry.queued=true;this.move(keys,0);}
  arrange(enabled,random=Math.random){this.shuffle=enabled;const manual=this.upcoming.filter(e=>e.manual||e.queued===true),context=this.upcoming.filter(e=>!e.manual&&e.queued!==true);if(enabled){for(let i=context.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[context[i],context[j]]=[context[j],context[i]];}}else context.sort((a,b)=>a.order-b.order);this.entries.splice(this.index+1,this.upcoming.length,...manual,...context);}
  serialize(){return {entries:this.entries,index:this.index,serial:this.serial,context:this.context,contextInfo:this.contextInfo,shuffle:this.shuffle,blockedArtists:this.blockedArtists};}
  restore(value){if(!value||!Array.isArray(value.entries)||!Number.isInteger(value.index)||value.index< -1||value.index>=value.entries.length)return false;const keys=new Set();for(const entry of value.entries){if(!entry||typeof entry.key!=='string'||keys.has(entry.key)||!entry.item?.id||!entry.item?.source)return false;keys.add(entry.key);}this.entries=value.entries;this.index=value.index;for(const [index,entry]of this.entries.entries())if(entry.queued!==true||index<=this.index)delete entry.queued;this.serial=Number.isSafeInteger(Number(value.serial))&&Number(value.serial)>=0?Number(value.serial):0;for(const key of keys){const match=/^queue:(\d+)$/.exec(key),number=Number(match?.[1]);if(Number.isSafeInteger(number))this.serial=Math.max(this.serial,number);}this.context=String(value.context||'');this.contextInfo=value.contextInfo&&typeof value.contextInfo==='object'?{...value.contextInfo}:null;this.shuffle=Boolean(value.shuffle);this.blockedArtists=Array.isArray(value.blockedArtists)?value.blockedArtists:[];this.artistPolicy(this.blockedArtists);return true;}
}
