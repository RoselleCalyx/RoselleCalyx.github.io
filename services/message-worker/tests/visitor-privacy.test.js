import assert from 'node:assert/strict';
import {test} from 'node:test';
import {redactNames,aliasForId} from '../src/visitor-privacy.js';
test('redaction escapes name punctuation, preserves ordinary words, and never replaces inside generated aliases',()=>{
 assert.equal(redactNames('A+B met A+B.',[{name:'A+B',alias:'Titan'}]),'Titan met Titan.');
 assert.equal(redactNames('Alice met Bob.',[{name:'Alice',alias:'Titan'},{name:'Bob',alias:'Dione'},{name:'T',alias:'Rhea'}]),'Titan met Dione.');
 assert.equal(redactNames('小明喜欢蘑菇。',[{name:'小明',alias:'Mimas'}]),'Mimas喜欢蘑菇。');
});

test('word-only aliases remain unique beyond the initial moons',()=>{
 const aliases = Array.from({length:10000},(_,i)=>aliasForId(i+1));
 assert.equal(aliases[0],'Titan');
 assert.equal(aliases[10],'Andromeda');
 assert.ok(aliases.includes('Amber Titan')); 
 assert.equal(new Set(aliases).size,aliases.length);
 assert.ok(aliases.every(alias=>/^[A-Za-z ]+$/.test(alias)));
});
