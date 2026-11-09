// Track occurrences use entry keys: repeated recordings remain separate entries.
export class PlaylistDraft {
  constructor(keys){this.original=[...keys];this.keys=[...keys];this.past=[];this.future=[];}
  get dirty(){return !same(this.keys,this.original);}
  change(keys){
    if(keys.length!==new Set(keys).size||keys.some(key=>!this.original.includes(key)))throw Error('Invalid playlist draft.');
    if(same(keys,this.keys))return false;
    this.past.push(this.keys);if(this.past.length>40)this.past.shift();this.keys=[...keys];this.future=[];return true;
  }
  remove(keys){const selected=new Set(keys);return this.change(this.keys.filter(key=>!selected.has(key)));}
  move(keys,index){const selected=new Set(keys),group=this.keys.filter(key=>selected.has(key)),rest=this.keys.filter(key=>!selected.has(key));rest.splice(Math.max(0,Math.min(rest.length,index)),0,...group);return this.change(rest);}
  undo(){if(!this.past.length)return false;this.future.push(this.keys);this.keys=this.past.pop();return true;}
  redo(){if(!this.future.length)return false;this.past.push(this.keys);this.keys=this.future.pop();return true;}
}
const same=(a,b)=>a.length===b.length&&a.every((key,index)=>key===b[index]);
