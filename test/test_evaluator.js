const evaluator = require('../evaluator');

/*
evaluator.evalExp(
    'a.b(c)+100', {
        a: {
            e: 10, 
            b(x) { console.log(this); return this.e * x; }
        }, 
        c: 5
}).then((val) => {
    console.log(val);
});
*/

let source = [
    'let a = { x: 123, y: 456 };', 
    'let y = `a: ${a}`;', 
    //'const fs = require(\'fs\');', 
    'function b(t) {', 
    '  if(t < 100)', 
    '    return 100;', 
    '  else', 
    '    return 200;', 
    '}', 
    'exports.m = a.y;', 
    'exports.n = b(200);'
].join('\n');

evaluator.evalCode(source, {}).then((result) => {
    console.log(result);
})
