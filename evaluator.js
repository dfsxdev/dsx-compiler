const evalExp = require('./evalexp');
const evalCode = require('./evalcode');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const htmlAttrReg = /^\{\{((?!\}\}).)*\}\}$/;
const htmlTextReg = /\{\{((?!\}\}).)*\}\}/g;
const htmlTextRegRaw = /\{\{=((?!\}\}).)*\}\}/g;
const rawTextReg = /\{\{((?!\}\}).)*\}\}/g;

function deduplicateStringArray(arr) {
    if(!arr) return arr;
    let map = {};
    arr.forEach((item) => {
        map[item] = true;
    });
    return Object.keys(map);
}

function evalReplace(text, reg, evCallback) {
    let temp = text.match(reg);
    
    let expressions = deduplicateStringArray(temp || []);
    let promises = [];
    let expressionMap = {};
    expressions.forEach((expression) => {
        promises.push(evCallback(expression).then((val) => {
            expressionMap[expression] = val;
        }));
    });
    
    return Promise.all(promises).then(() => {
        return text.replace(reg, (expression) => {
            return expressionMap[expression];
        });
    });
}

module.exports = {
    // getHtmlAttrExp
    getHtmlAttrExp(attr) {
        attr = entities.decode(attr).trim();
        if (htmlAttrReg.test(attr)) {
            return attr.substring(2, attr.length - 2);
        } else {
            return attr;
        }
    }, 
    // eval
    evalExp(expression, data) {
        try {
            return evalExp(expression, data);
        } catch (err) {
            console.log('failed to evaluate expression ' + expression);
            console.log(err);
            return Promise.resolve(null);
        }
    }, 
    // unescape -> eval -> escape
    evalHtmlExp(expression, data) {
        expression = entities.decode(expression);
        return this.evalExp(expression, data).then((val) => {
            return ((val !== null && val != undefined) ? entities.encode(val.toString()): '');
        });
    }, 
    // unescape -> eval -> escape
    evalHtmlAttr(attr, data) {
        attr = entities.decode(attr).trim();
        if (htmlAttrReg.test(attr)) {
            return this.evalExp(attr.substring(2, attr.length - 2), data).then((val) => {
                return ((val !== null && val != undefined) ? entities.encode(val.toString()): '');
            });
        } else {
            return Promise.resolve(attr);
        }
    }, 
    // unescape -> eval
    evalModuleAttr(attr, data) {
        attr = entities.decode(attr).trim();
        if (htmlAttrReg.test(attr)) {
            return this.evalExp(attr.substring(2, attr.length - 2), data);
        } else {
            return Promise.resolve(attr);
        }
    }, 
    // unescape -> eval -> escape
    evalHtmlContent(text, data) {
        return evalReplace(text, htmlTextRegRaw, (str) => {
            str = str.substring(3, str.length - 2);
            str = entities.decode(str);
            return this.evalExp(str, data).then((val) => {
                return ((val !== null && val != undefined) ? val.toString(): '');
            });
        }).then((text) => {
            return evalReplace(text, htmlTextReg, (str) => {
                return this.evalHtmlExp(str.substring(2, str.length - 2), data);
            })
        });
    }, 
    // eval
    evalRawText(text, data) {
        return evalReplace(text, rawTextReg, (str) => {
            str = str.substring(2, str.length - 2);
            return this.evalExp(str, data).then((val) => {
                return ((val !== null && val != undefined) ? val.toString(): '');
            });
        });
    }, 
    //eval
    evalCode(code, data) {
        try {
            return evalCode(code, data);
        } catch (err) {
            console.log('failed to evaluate code: ' + (code.length > 100 ? code.substr(0, 100) + '...' : code));
            console.log(err);
            return Promise.resolve(null);
        }
    }
};