const esprima = require('esprima');

let codeParseInfoCache = [];
const MAX_CODE_PARSE_INFO_CACHE_SIZE = 20;

function nodeCallback(node, meta, tokens) {
    let processIdentifier = (node) => {
        if(node.name != 'module' && node.name != 'exports') {
            tokens[node.name] = undefined;
        }
    };
    
    switch(node.type) {
        case 'ArrayExpression':
            for(let element in node.elements) {
                if(element.type == 'Identifier') {
                    processIdentifier(element);
                }
            }
            break;
        case 'ObjectExpression': 
            for(let property in node.properties) {
                if(property.value && property.value.type == 'Identifier') {
                    processIdentifier(property.value);
                }
            }
            break;
        case 'ArrowFunctionExpression':
            if(node.body.type == 'Identifier') {
                processIdentifier(node.body);
            }
            break;
        case 'ClassExpression':
            if(node.superClass && node.superClass.type == 'Identifier') {
               processIdentifier(node.superClass); //type identifier
            }
            break;
        case 'MemberExpression':
            if(node.object.type == 'Identifier') {
                processIdentifier(node.object);
            }
            if(node.computed && node.property.type == 'Identifier') { //member by []
                processIdentifier(node.property);
            }
            break;
        case 'CallExpression':
            if(node.callee.type == 'Identifier') {
                processIdentifier(node.callee);
            }
            for(let argument in node.arguments) {
                if(argument.type == 'Identifier') {
                    processIdentifier(argument);
                }
            }
            break;
        case 'NewExpression':
            if(node.calee.type == 'Identifier') {
                processIdentifier(node.callee); //type identifier
            }
            for(let argument in node.arguments) {
                if(argument.type == 'Identifier') {
                    processIdentifier(argument);
                }
            }
            break;
        case 'UpdateExpression':
            if(node.argument.type == 'Identifier') {
                processIdentifier(node.argument); //left value needed
            }
            break;
        case 'AwaitExpression':
            if(node.argument.type == 'Identifier') {
                processIdentifier(node.argument); //await already
            }
            break;
        case 'UnaryExpression':
            if(node.argument.type == 'Identifier') {
                processIdentifier(node.argument);
            }
            break;
        case 'BinaryExpression':
            if(node.left.type == 'Identifier') {
                processIdentifier(node.left);
            }
            if(node.right.type == 'Identifier') {
                processIdentifier(node.right);
            }
            break;
        case 'LogicalExpression':
            if(node.left.type == 'Identifier') {
                processIdentifier(node.left);
            }
            if(node.right.type == 'Identifier') {
                processIdentifier(node.right);
            }
            break;
        case 'ConditionalExpression':
            if(node.test.type == 'Identifier') {
                processIdentifier(node.test);
            }
            if(node.consequent.type == 'Identifier') {
                processIdentifier(node.consequent);
            }
            if(node.alternate && node.alternate.type == 'Identifier') {
                processIdentifier(node.alternate);
            }
            break;
        case 'YieldExpression':
            if(node.argument.type == 'Identifier') {
                processIdentifier(node.argument);
            }
            break;
        case 'AssignmentExpression':
            if(node.left.type == 'Identifier') {
                processIdentifier(node.left, true); //left value needed
            }
            if(node.right.type == 'Identifier') {
                processIdentifier(node.right);
            }
            break;
        case 'SequenceExpression':
            for(let expression in node.expressions) {
                if(expression.type == 'Identifier') {
                    processIdentifier(node.expression);
                }
            }
            break;
        case 'TemplateLiteral':
            for(let expression in node.expressions) {
                if(expression.type == 'Identifier') {
                    processIdentifier(node.expression);
                }
            }
            break;
        case 'ImportDeclaration':
            throw new Error('unknown token: import');
        case 'ExportDeclaration':
            throw new Error('unknown token: export');
    }
}

function getCodeParseInfoFromCache(code) {
    for(let i = 0; i < codeParseInfoCache.length; ++i) {
        if(codeParseInfoCache[i].code == code) {
            return codeParseInfoCache[i];
        }
    }
}

function addCodeParseInfoToCache(parseInfo) {
    codeParseInfoCache.push(parseInfo);
    if(codeParseInfoCache.length > MAX_CODE_PARSE_INFO_CACHE_SIZE) {
        codeParseInfoCache.shift();
    }
}

module.exports = function(code, data) {
    let asyncSupport = (parseInt(process.versions['node'].split('.')[0])  >= 8);
    let parseInfo = getCodeParseInfoFromCache(code);
    let tokens = {};
    if(!parseInfo) {
        if(asyncSupport) {
            code = '(async function(){\n' + code + '\n})()';
        } else {
            code = '(function(){\n' + code + '\n})()';
        }
        esprima.parseScript(code, { range: true }, (node, meta) => {
            nodeCallback(node, meta, tokens);
        });
        addCodeParseInfoToCache({ code, tokens });
    } else {
        tokens = parseInfo.tokens;
    }

    // node version under 8
    if(asyncSupport) {
        let prefixs = [
            '(async function(__context) {', 
            '  let exports = {};', 
            '  let module = { exports: exports };'
        ];
        for(let token in tokens) {
            prefixs.push(`  let ${token} = __context['${token}'];`);
        }

        let postfixs = [
            '  return module.exports;', 
            '})(data);'
        ];

        code = prefixs.join('\n') + '\nawait ' + code + ';\n' + postfixs.join('\n');
    } else {
        let prefixs = [
            '(function(__context) {', 
            '  let exports = {};', 
            '  let module = { exports: exports };'
        ];
        for(let token in tokens) {
            prefixs.push(`  let ${token} = __context['${token}'];`);
        }

        let postfixs = [
            '  return module.exports;', 
            '})(data);'
        ];

        code = prefixs.join('\n') + '\n' + code + ';\n' + postfixs.join('\n');
    }
    
    return Promise.resolve(eval(code));
}