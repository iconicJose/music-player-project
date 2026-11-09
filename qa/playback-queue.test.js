import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackQueue} from '../public/playback-queue.js';
const item=n=>({source:'youtube',id:String(n),title:'Track '+n});
function queue(){const model=new PlaybackQueue(),items=[1,2,3,4,5].map(item);model.start(items[0],items,'Playlist');return model;}

test('explicit additions play next in FIFO order before the playlist continues',()=>{const q=queue();q.add(item(9));q.add(item(8));assert.deepEqual(q.upcoming.map(e=>e.item.id),['9','8','2','3','4','5']);assert.equal(q.next().item.id,'9');assert.equal(q.next().item.id,'8');assert.equal(q.next().item.id,'2');});
test('repeated recordings have distinct queue keys and remove independently',()=>{const q=queue(),one=q.add(item(9)),two=q.add(item(9));assert.notEqual(one.key,two.key);q.remove([one.key]);assert.equal(q.next().key,two.key);});
test('shuffle does not change current track or explicit addition order',()=>{const q=queue(),current=q.current;q.add(item(9));q.add(item(8));q.arrange(true,()=>0);assert.equal(q.current,current);assert.deepEqual(q.upcoming.slice(0,2).map(e=>e.item.id),['9','8']);assert.notDeepEqual(q.upcoming.slice(2).map(e=>e.item.id),['2','3','4','5']);});
test('disabling shuffle restores remaining order without resurrecting removals or played items',()=>{const q=queue();q.arrange(true,()=>0);const removed=q.upcoming.find(e=>e.item.id==='4');q.remove([removed.key]);const played=q.next();q.arrange(false);assert.ok(!q.upcoming.some(e=>e.key===removed.key||e.key===played.key));assert.deepEqual(q.upcoming.map(e=>e.item.id),['2','5']);});
test('edited order survives a later shuffle toggle',()=>{const q=queue();q.reorder([...q.upcoming].reverse().map(e=>e.key));q.arrange(true,()=>0);q.arrange(false);assert.deepEqual(q.upcoming.map(e=>e.item.id),['5','4','3','2']);});
test('multiselect movement preserves selected occurrence order',()=>{const q=queue();q.move([q.upcoming[2].key,q.upcoming[0].key],2);assert.deepEqual(q.upcoming.map(e=>e.item.id),['3','5','2','4']);});
test('new context preserves explicit pending additions and shuffle setting',()=>{const q=queue();q.add(item(9));q.arrange(true,()=>0);const list=[6,7,8].map(item);q.start(list[1],list,'Other');assert.equal(q.current.item.id,'7');assert.equal(q.upcoming[0].item.id,'9');assert.equal(q.shuffle,true);assert.equal(q.context,'Other');});
test('jump, previous, end-of-queue and repeat respect occurrence identities',()=>{const q=queue();const last=q.upcoming.at(-1);q.jump(last.key);assert.equal(q.next(),null);assert.equal(q.previous().item.id,'4');q.jump(last.key);assert.equal(q.next(true).item.id,'1');});
test('stale or incomplete reorder is rejected without losing entries',()=>{const q=queue(),before=q.serialize().entries.map(e=>e.key);assert.throws(()=>q.reorder([q.upcoming[0].key]));assert.throws(()=>q.reorder(q.upcoming.map(()=>q.upcoming[0].key)));assert.deepEqual(q.entries.map(e=>e.key),before);});
test('queue state survives a UI reload including pending duplicate additions',()=>{const q=queue();q.add(item(9));q.add(item(9));q.arrange(true,()=>.2);const restored=new PlaybackQueue();assert.equal(restored.restore(JSON.parse(JSON.stringify(q.serialize()))),true);assert.deepEqual(restored.serialize(),q.serialize());const added=restored.add(item(9));assert.equal(new Set(restored.entries.map(e=>e.key)).size,restored.entries.length);assert.ok(added);});
test('unavailable entries do not enter the playable queue',()=>{const q=queue();assert.equal(q.add({...item(9),unavailable:true}),null);assert.ok(!q.upcoming.some(e=>e.item.id==='9'));});

test('next preparation follows manual queue order and repeat modes without advancing playback',()=>{
 const q=new PlaybackQueue(),a={source:'youtube',id:'a'},b={source:'youtube',id:'b'},manual={source:'youtube',id:'manual'};
 q.start(a,[a,b]);q.add(manual);assert.equal(q.nextItem(0),manual);assert.equal(q.current.item,a);assert.equal(q.nextItem(2),a);
 q.next();assert.equal(q.nextItem(0),b);q.next();assert.equal(q.nextItem(0),null);assert.equal(q.nextItem(1),a);
});

const contextKeys=q=>q.entries.filter(entry=>!entry.manual).map(({key,item})=>({key,source:item.source,id:item.id}));
test('a late full artist list appends its exact tail without restarting the current occurrence',()=>{
 const q=queue(),keys=contextKeys(q),first=q.current,full=[1,2,3,4,5,6,7].map(item);
 assert(q.extendContext(keys,full));assert.equal(q.current,first);assert.deepEqual(q.entries.map(entry=>entry.item.id),full.map(entry=>entry.id));
 assert.deepEqual(q.entries.slice(0,5).map(entry=>entry.key),keys.map(entry=>entry.key));assert.equal(new Set(q.entries.map(entry=>entry.key)).size,7);
 const restored=new PlaybackQueue();assert(restored.restore(JSON.parse(JSON.stringify(q.serialize()))));assert.deepEqual(restored.serialize(),q.serialize());
});
test('full artist continuation retains manual duplicates, their order, and an already advanced position',()=>{
 const q=queue(),keys=contextKeys(q),one=q.add(item(9)),two=q.add(item(9));q.next();const current=q.current;
 assert(q.extendContext(keys,[1,2,3,4,5,6].map(item)));assert.equal(q.current,current);assert.equal(q.current.key,one.key);assert.equal(q.upcoming[0].key,two.key);
 assert.deepEqual(q.entries.map(entry=>entry.item.id),['1','9','9','2','3','4','5','6']);
});
test('an obsolete full artist response cannot replace a newer playback context',()=>{
 const q=queue(),keys=contextKeys(q);q.start(item(1),[1,2,3,4,5].map(item),'Other');const before=JSON.stringify(q.serialize());
 assert.equal(q.extendContext(keys,[1,2,3,4,5,6].map(item)),false);assert.equal(JSON.stringify(q.serialize()),before);
});
test('a full artist response retains queue removals, reordering and active shuffle while adding the missing tail',()=>{
 for(const edit of [q=>q.remove([q.upcoming[0].key]),q=>q.reorder([...q.upcoming].reverse().map(entry=>entry.key)),q=>q.arrange(true,()=>0)]){
  const q=queue(),keys=contextKeys(q);edit(q);const before=JSON.stringify(q.serialize().entries),current=q.current,shuffled=q.shuffle;
  assert(q.extendContext(keys,[1,2,3,4,5,6,7,8].map(item),()=>0));assert.equal(JSON.stringify(q.entries.slice(0,-3)),before);assert.equal(q.current,current);assert.equal(q.shuffle,shuffled);
  assert.deepEqual(q.entries.slice(-3).map(entry=>entry.item.id),shuffled?['7','8','6']:['6','7','8']);
 }
});
test('a changed upstream artist order is never silently spliced onto the initial list',()=>{
 for(const full of [[1,3,2,4,5,6],[1,2,3],[1,2,3,4,8,6]]){
  const q=queue(),before=JSON.stringify(q.serialize());assert.equal(q.extendContext(contextKeys(q),full.map(item)),false);assert.equal(JSON.stringify(q.serialize()),before);
 }
});
test('artist continuation keeps repeated recording occurrences and skips unavailable and blocked tail entries',()=>{
 const q=queue(),keys=contextKeys(q);q.blockedArtists=[{id:'blocked',name:'Blocked'}];
 const full=[1,2,3,4,5,1].map(item);full.push({...item(8),unavailable:true},{...item(9),artist:'Blocked',artistIds:['blocked']},item(7));
 assert(q.extendContext(keys,full));assert.deepEqual(q.entries.map(entry=>entry.item.id),['1','2','3','4','5','1','7']);assert.notEqual(q.entries[0].key,q.entries[5].key);
});
test('artist continuation cannot apply the same late tail twice',()=>{
 const q=queue(),keys=contextKeys(q),full=[1,2,3,4,5,6].map(item);assert(q.extendContext(keys,full));const before=JSON.stringify(q.serialize());assert.equal(q.extendContext(keys,full),false);assert.equal(JSON.stringify(q.serialize()),before);
});

test('a stale or missing restored counter cannot reuse an existing occurrence identity',()=>{for(const serial of [1,0,-1,undefined,NaN,Infinity,'invalid']){const original=queue();original.add(item(9));original.add(item(9));original.moveUp([original.upcoming.at(-1).key]);const snapshot=structuredClone(original.serialize()),entries=structuredClone(snapshot.entries);snapshot.serial=serial;const restored=new PlaybackQueue();assert(restored.restore(snapshot));assert.deepEqual(restored.entries,entries);assert.equal(restored.current.key,original.current.key);assert.equal(restored.context,original.context);restored.add(item(9));assert.equal(new Set(restored.entries.map(entry=>entry.key)).size,restored.entries.length);assert(restored.serial>=original.serial);}});
test('restoration derives the counter from sparse high identities without renaming or reordering them',()=>{const source=queue(),state=structuredClone(source.serialize());state.entries[1].key='queue:9000';state.serial=2;const restored=new PlaybackQueue();assert(restored.restore(state));const before=restored.entries.map(entry=>entry.key),added=restored.add(item(8));assert.equal(added.key,'queue:9001');assert.deepEqual(restored.entries.filter(entry=>entry!==added).map(entry=>entry.key),before);});
test('an exhausted numeric counter uses distinct string identities supported by the native queue',()=>{const source=queue(),state=structuredClone(source.serialize());state.entries[1].key='queue:'+Number.MAX_SAFE_INTEGER;state.serial=Number.MAX_SAFE_INTEGER;const restored=new PlaybackQueue();assert(restored.restore(state));const one=restored.add(item(8)),two=restored.add(item(8));assert.notEqual(one.key,two.key);assert.equal(new Set(restored.entries.map(entry=>entry.key)).size,restored.entries.length);restored.remove([one.key]);assert(restored.entries.some(entry=>entry.key===two.key));const again=new PlaybackQueue();assert(again.restore(JSON.parse(JSON.stringify(restored.serialize()))));assert.deepEqual(again.entries,restored.entries);});

test('offline queue navigation skips unavailable audio without removing or reordering occurrences',()=>{
 const q=queue(),manual=q.add(item(9)),keys=q.entries.map(entry=>entry.key),original=q.entries.map(entry=>entry.item),saved=value=>['1','3','5','9'].includes(value.id);
 assert.equal(q.next(false,saved).key,manual.key);assert.equal(q.next(false,saved).item.id,'3');assert.equal(q.next(false,saved).item.id,'5');const last=q.current;assert.equal(q.next(false,saved),null);assert.strictEqual(q.current,last);assert.equal(q.previous(saved).item.id,'3');assert.equal(q.previous(saved).key,manual.key);assert.deepEqual(q.entries.map(entry=>entry.key),keys);assert.deepEqual(q.entries.map(entry=>entry.item),original);
});
test('offline repeat finds an actual downloaded context occurrence and does not repeat manual entries alone',()=>{
 const q=queue(),manual=q.add(item(9)),saved=value=>value.id==='9';q.jump(manual.key);assert.equal(q.next(true,saved),null);assert.equal(q.nextEntry(true,saved),null);assert.strictEqual(q.current,manual);
 const available=value=>value.id==='3';assert.equal(q.next(true,available).item.id,'3');assert.equal(q.next(true,available).item.id,'3');
});
test('network return restores normal navigation over retained queue occurrences',()=>{
 const q=queue(),keys=q.entries.map(entry=>entry.key);assert.equal(q.next(false,item=>item.id==='4').item.id,'4');assert.equal(q.previous().item.id,'3');assert.equal(q.previous().item.id,'2');assert.equal(q.next().item.id,'3');assert.deepEqual(q.entries.map(entry=>entry.key),keys);
});
