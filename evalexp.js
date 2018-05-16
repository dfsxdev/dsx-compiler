const esprima = require('esprima');

function evalExpTree(expression, data) {
    let wrapValue = (obj, val) => {
        if(typeof val == 'function') {
            return {
                __obj: obj, 
                __func: val
            };
        } else {
            return val;
        }
    };
    
    switch(expression.type) {
        case 'Identifier':
            if(data[expression.name] === undefined) {
                switch(expression.name) {
                    case 'Math':
                        return Promise.resolve(Math);
                }
            }
            else return Promise.resolve(data[expression.name]).then((val) => {
                return wrapValue(data, val);
            });
        case 'Literal': 
            return Promise.resolve(expression.value);
        case 'ArrayExpression':
            {
                let promises = [];
                expression.elements.forEach((el) => {
                    promises.push(evalExpTree(el, data));
                });
                return Promise.all(promises).then((objs) => {
                    return objs;
                });
            }
        case 'CallExpression':
            {
                let promises = [];
                promises.push(evalExpTree(expression.callee, data));
                expression.arguments.forEach((arg) => {
                    promises.push(evalExpTree(arg, data));
                });
                return Promise.all(promises).then((objs) => {
                    return objs[0].__func.apply(objs[0].__obj, objs.slice(1));
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
        case 'UnaryExpression':
            return Promise.resolve(evalExpTree(expression.argument, data)).then((arg) => {
                switch(expression.operator) {
                case '+':
                    return +arg;
                case '-':
                    return -arg;
                case '~':
                    return ~arg;
                case '!':
                    return !arg;
                case 'typeof':
                    return (typeof arg);
                default:
                    throw new Error('unknown operator ' + expression.operator);
                }
            });
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
                case '%':
                    return ops[0] % ops[1];
                case '|':
                    return ops[0] | ops[1];
                case '^':
                    return ops[0] ^ ops[1];
                case '&':
                    return ops[0] & ops[1];
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
        case 'LogicalExpression':
            return Promise.all([
                evalExpTree(expression.left, data), 
                evalExpTree(expression.right, data)
            ]).then((ops) => {
                switch(expression.operator) {
                case '||':
                    return ops[0] || ops[1];
                case '&&':
                    return ops[0] && ops[1];
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
        case 'NewExpression':
            {
                let promises = [];
                promises.push(evalExpTree(expression.callee, data));
                expression.arguments.forEach((arg) => {
                    promises.push(evalExpTree(arg, data));
                });
                return Promise.all(promises).then((objs) => {
                    if(objs[0].__func == Date) {
                        return new Date(...objs.slice(1));
                    }
                    let o = Object.create(objs[0].__func.prototype);
                    let result = objs[0].__func.apply(o, objs.slice(1));
                    return ((result != null && (typeof result == 'object' || typeof result == 'function')) ? result : o);
                });
            }
        default:
            throw new Error('invalid expression ' + expression.type);
    }
}

module.exports = function(expression, data) {
    let script = esprima.parse(expression);
    if(script.body.length != 1 || 
        script.body[0].type != 'ExpressionStatement') {
            throw new Error('not a valid expression');
        }
    
    return evalExpTree(script.body[0].expression, data).then((result) => {
        if(typeof result == 'object' && result['__obj'] && result['__func']) { //here we unwrap functions
            return result['__func'];
        } else {
            return result;
        }
    });
};