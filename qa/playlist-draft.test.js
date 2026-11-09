import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaylistDraft} from '../public/playlist-draft.js';

test('duplicate recordings retain independent occurrence keys through removal and undo',()=>{
  const model=new PlaylistDraft(['import:0','import:1','import:2']);
  model.remove(['import:1']);assert.deepEqual(model.keys,['import:0','import:2']);
  assert.equal(model.dirty,true);model.undo();assert.deepEqual(model.keys,model.original);assert.equal(model.dirty,false);
  model.redo();assert.deepEqual(model.keys,['import:0','import:2']);
});
test('noncontiguous selection moves together in source order, supports undo and redo',()=>{
  const model=new PlaylistDraft(['a','b','c','d','e']);
  model.move(['d','b'],0);assert.deepEqual(model.keys,['b','d','a','c','e']);
  model.undo();model.move(['b','d'],3);assert.deepEqual(model.keys,['a','c','e','b','d']);
  model.undo();model.redo();assert.deepEqual(model.keys,['a','c','e','b','d']);
});
test('new edits clear redo and invalid keys cannot corrupt the draft',()=>{
  const model=new PlaylistDraft(['a','b']);model.remove(['a']);model.undo();model.remove(['b']);
  assert.equal(model.redo(),false);assert.deepEqual(model.keys,['a']);
  assert.throws(()=>model.change(['a','a']));assert.throws(()=>model.change(['missing']));assert.deepEqual(model.keys,['a']);
});
test('removing every entry, restoring original order, and no-op moves have correct dirty state',()=>{
  const model=new PlaylistDraft(['a','b']);assert.equal(model.move(['a'],0),false);assert.equal(model.past.length,0);
  model.remove(['a','b']);assert.deepEqual(model.keys,[]);assert.equal(model.dirty,true);model.undo();assert.equal(model.dirty,false);
  model.move(['b'],0);model.move(['a'],0);assert.equal(model.dirty,false);
});
