const esprima = require('esprima');
const Entities = require('html-entities').AllHtmlEntities;
const entities = new Entities();
const htmlAttrReg = /^\{\{((?!\}\}).)*\}\}$/;
const htmlTextReg = /\{\{((?!\}\}).)*\}\}/g;
const htmlTextRegRaw = /\{\{=((?!\}\}).)*\}\}/g;
const rawTextReg = /\{\{((?!\}\}).)*\}\}/g;

function uniqueStringArray(arr) {
    if(!arr) return arr;
    let map = {};
    arr.forEach((item) => {
        map[item] = true;
    });
    return Object.keys(map);
}

function evalExpTree(expression, data) {
    let wrapValue = (obj, val) => {
        if(typeof val == 'function') {
            return {
                obj: obj, 
                func: val
            };
        } else {
            return val;
        }
    };
    
    switch(expression.type) {
        case 'Identifier':
            return Promise.resolve(data[expression.name]).then((val) => {
                return wrapValue(data, val);
            });
        case 'Literal': 
            return Promise.resolve(expression.value);
        case 'BinaryExpression': 
            return Promise.all([
                evalExpTree(expression.left, data), 
                evalExpTree(expression.right, data)
            ]).then((ops) => {
                switch(expression.operator) {
                case '+':
                    return ops[0] + ops[1];
                case '-':
                    return ops[0] - ops[1];
                case '*':
                    return ops[0] * ops[1];
                case '/':
                    return ops[0] / ops[1];
                case '>>':
                    return ops[0] >> ops[1];
                case '<<':
                    return ops[0] << ops[1];
                case '>':
                    return ops[0] > ops[1];
                case '>=':
                    return ops[0] >= ops[1];
                case '<':
                    return ops[0] < ops[1];
                case '<=':
                    return ops[0] <= ops[1];
                case '==':
                    return ops[0] == ops[1];
                case '===':
                    return ops[0] === ops[1];
                case '!=':
                    return ops[0] != ops[1];
                case '!==':
                    return ops[0] !== ops[1];
                default:
                    throw new Error('unknown operator ' + expression.operator);
                }
            });
        case 'ConditionalExpression': 
            return evalExpTree(expression.test, data).then((val) => {
                if(val) {
                    return evalExpTree(expression.consequent, data);
                } else {
                    return evalExpTree(expression.alternate, data);
                }
            });
        case 'CallExpression':
            {
                let promises = [];
                promises.push(evalExpTree(expression.callee, data));
                expression.arguments.forEach((arg) => {
                    promises.push(evalExpTree(arg, data));
                });
                return Promise.all(promises).then((objs) => {
                    return objs[0].func.apply(objs[0].obj, objs.slice(1));
                });
            }
        case 'MemberExpression':
            if(expression.computed) {
                return Promise.all([
                    evalExpTree(expression.object, data), 
                    evalExpTree(expression.property, data)
                ]).then((objs) => {
                    return Promise.resolve(objs[0][objs[1]]).then((val) => {
                        return wrapValue(objs[0], val);
                    });
                })
            } else {
                return evalExpTree(expression.object, data).then((obj) => {
                    return Promise.resolve(obj[expression.property.name]).then((val) => {
                        return wrapValue(obj, val);
                    });
                });
            }
        default:
            throw new Error('invalid expression ' + expression.type);
    }
}

function evalExp(expression, data) {
    let script = esprima.parse(expression);
    if(script.body.length != 1 || 
        script.body[0].type != 'ExpressionStatement') {
            throw new Error('not a valid expression');
        }
    
    return evalExpTree(script.body[0].expression, data);
}

function evalReplace(text, reg, ev) {
    let temp = text.match(reg);
    
    let expressions = uniqueStringArray(temp || []);
    let promises = [];
    let expressionMap = {};
    expressions.forEach((expression) => {
        promises.push(ev(expression).then((val) => {
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
    }
};