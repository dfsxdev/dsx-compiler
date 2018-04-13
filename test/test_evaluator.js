const evaluator = require('../evaluator');
evaluator.evalExp(
    'a.b(c)+100', {
        a: {
            e: 10, 
            b(x) { console.log(this); return this.e * x; }
        }, 
        c: 5
}).then((val) => {
    console.log(val);
})