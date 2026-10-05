/** App interaction regression checks. The small DOM harness uses no dependencies;
 * actual layout, browser dialog focus trapping and audio output require browser QA. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from './engine.js';

function loadApp() {
  const ids=new Map();
  class Events {
    constructor(){this.listeners={};}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    dispatchEvent(event){event.preventDefault??=()=>{event.defaultPrevented=true;};for(const listener of this.listeners[event.type]??[])listener(event);return !event.defaultPrevented;}
  }
  const document=new Events();
  class Element extends Events {
    constructor(tag='div',id=''){super();this.tagName=tag.toUpperCase();this.id=id;this.dataset={};this.style={};this.attributes={};this.children=[];this.disabled=false;this.hidden=false;this.open=false;this._html='';const classes=new Set();this.classList={toggle(name,force){const enabled=force??!classes.has(name);if(enabled)classes.add(name);else classes.delete(name);return enabled;},contains(name){return classes.has(name);}};}
    set innerHTML(value){
      const remove=node=>{for(const child of node.children)remove(child);if(document.activeElement===node)document.activeElement=document.body;if(node.id&&ids.get(node.id)===node)ids.delete(node.id);};
      for(const child of this.children)remove(child);this.children=[];this._html=value;
      for(const match of value.matchAll(/<([a-z]+)\b([^>]*)>/gi)){
        const id=match[2].match(/\bid="([^"]+)"/)?.[1];
        if(id||match[1]==='canvas'){const child=new Element(match[1],id);child.disabled=/\sdisabled(?:\s|$|=)/.test(match[2]);this.append(child);if(id)ids.set(id,child);}
      }
    }
    get innerHTML(){return this._html;}
    append(child){child.parentElement=this;this.children.push(child);}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    querySelector(selector){return this.children.find(c=>c.tagName.toLowerCase()===selector)||null;}
    getContext(){return {};}
    focus(){if(!this.disabled)document.activeElement=this;}
    click(){if(this.disabled)return;const event={type:'click',target:this,preventDefault(){}};this.onclick?.(event);this.dispatchEvent(event);}
    showModal(){this.open=true;}
    close(){this.open=false;}
  }
  document.body=new Element('body');document.activeElement=document.body;document.hidden=false;
  document.createElement=tag=>new Element(tag);document.getElementById=id=>ids.get(id)||null;
  const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi))ids.set(match[2],new Element(match[1],match[2]));
  class Soundscape {
    constructor(){this.enabled=false;this.paused=false;this.cues=[];}
    setPaused(value){this.paused=Boolean(value);}
    cue(name){this.cues.push(name);}
    async toggle(){this.enabled=!this.enabled;return this.enabled;}
  }
  let now=100;const window=new Events();
  const context={...engine,Soundscape,document,window,render(){},drawTowerIcon(){},matchMedia:()=>({matches:false}),performance:{now:()=>now},requestAnimationFrame:()=>0,console};
  vm.createContext(context);
  const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');
  vm.runInContext(source+'\nglobalThis.audit={game,music,sync,reset,chooseType,selectPad,frame};',context);
  return {...context.audit,$:id=>ids.get(id),document,window,advance(ms){now+=ms;context.audit.frame(now);}};
}

test('app: opening guide pauses and dismissing it restores build mode',()=>{
  const a=loadApp();assert.equal(a.$('guide').open,true);assert.equal(a.game.paused,true);assert.equal(a.music.paused,true);
  a.$('begin').click();assert.equal(a.$('guide').open,false);assert.equal(a.game.paused,false);assert.equal(a.music.paused,false);
  assert.equal(a.$('tower-shop').children.length,4);assert.equal(a.$('pad-buttons').children.length,16);
});

test('app: cancel button, Escape and map-background cancellation do not charge or build',()=>{
  const a=loadApp();a.$('begin').click();
  for(const cancel of [()=>a.$('cancel-build').click(),()=>a.window.dispatchEvent({type:'keydown',key:'Escape'}),()=>a.$('board').click()]){
    a.chooseType('lantern');cancel();a.selectPad('p3');assert.equal(a.game.gold,240);assert.equal(a.game.towers.length,0);
  }
});

test('app: duplicate build, upgrade, sell and start clicks cannot duplicate transactions',()=>{
  const a=loadApp();a.$('begin').click();a.chooseType('lantern');a.selectPad('p3');
  for(let i=0;i<20;i++)a.selectPad('p3');assert.equal(a.game.gold,170);assert.equal(a.game.towers.length,1);
  a.$('upgrade').click();a.$('upgrade').click();assert.equal(a.game.gold,95);assert.equal(a.game.towers[0].level,2);
  const sell=a.$('sell');sell.click();sell.click();assert.equal(a.game.gold,196);assert.equal(a.game.towers.length,0);
  for(let i=0;i<20;i++)a.$('start').click();assert.equal(a.game.totalEnemies,8);assert.equal(a.game.spawnQueue.length,8);
});

test('app: selected action retains keyboard focus as live bounty updates rebuild details',()=>{
  const a=loadApp();a.$('begin').click();a.chooseType('lantern');a.selectPad('p3');
  for(const id of ['upgrade','sell']){a.$(id).focus();const old=a.$(id);a.game.gold+=8;a.sync();assert.notEqual(a.$(id),old);assert.equal(a.document.activeElement,a.$(id));}
});

test('app: guide and restart cancellation preserve prior pause and gameplay state',()=>{
  const a=loadApp();a.$('begin').click();a.chooseType('tea');a.selectPad('p3');const towers=JSON.stringify(a.game.towers);
  a.$('restart').click();assert.equal(a.game.paused,true);a.$('cancel-reset').click();assert.equal(a.game.paused,false);assert.equal(JSON.stringify(a.game.towers),towers);
  a.$('pause').click();a.$('help').click();a.$('close-guide').click();assert.equal(a.game.paused,true);assert.equal(a.music.paused,true);
  a.$('guide').dispatchEvent({type:'cancel'});assert.equal(a.game.paused,true);
});

test('app: confirmed restart clears pending selection, towers, battle state and pause',()=>{
  const a=loadApp();a.$('begin').click();a.chooseType('lantern');a.selectPad('p3');a.$('start').click();a.advance(250);a.chooseType('tea');
  a.$('restart').click();a.$('confirm-reset').click();assert.equal(a.$('confirm').open,false);assert.deepEqual(a.game,new engine.Game());assert.equal(a.music.paused,false);
  a.selectPad('p5');assert.equal(a.game.towers.length,0);assert.equal(a.game.gold,240);
});

test('app: starting a wave after paused preparation synchronizes game and music',()=>{
  const a=loadApp();a.$('begin').click();a.$('pause').click();assert.equal(a.game.paused,true);assert.equal(a.music.paused,true);
  a.$('start').click();assert.equal(a.game.status,'wave');assert.equal(a.game.paused,false);assert.equal(a.music.paused,false);
});

test('app: hiding an active battle pauses once without automatically resuming',()=>{
  const a=loadApp();a.$('begin').click();a.$('start').click();a.advance(250);
  a.document.hidden=true;a.document.dispatchEvent({type:'visibilitychange'});assert.equal(a.game.paused,true);assert.equal(a.music.paused,true);
  const before=JSON.stringify(a.game);a.advance(1000);assert.equal(JSON.stringify(a.game),before);
  a.document.hidden=false;a.document.dispatchEvent({type:'visibilitychange'});assert.equal(a.game.paused,true);
  a.$('pause').click();assert.equal(a.game.paused,false);assert.equal(a.music.paused,false);
});

test('app: keyboard Space pauses background focus but leaves focused buttons to native activation',()=>{
  const a=loadApp();a.$('begin').click();
  a.window.dispatchEvent({type:'keydown',code:'Space'});assert.equal(a.game.paused,true);
  a.$('start').focus();a.window.dispatchEvent({type:'keydown',code:'Space'});assert.equal(a.game.paused,true);
});
