const HtmlParser = require('htmlparser2');
const { h, t, ht } = require('./vnode');
const directiveRepo = require('./directives');
const evaluator = require('./evaluator');
const crypto = require('crypto');
const globalContext = require('./global_context');

let IdGenerator = function () {
    let nextId = 0;
    this.next = function (content) {
        let md5 = crypto.createHash('md5');
        md5.update(content);
        let hash = md5.digest('hex');
        let str = (parseInt(hash.substring(0, 4), 16) + ((++nextId) << 16)).toString(16);
        if (str.length < 7) {
            let zeroNumber = 7 - str.length;
            while(zeroNumber-- > 0)str = '0' + str;
        }
        return str;
    };
};

let containsDirectives = (vnode) => {
    for (let key in vnode.attrs) {
        if (key.slice(0, 3) == 'ds-' && directiveRepo.has(key.slice(3))) {
            return true;
        }
    }
    return false;
};
    
let bindDirectives = (vnode) => {
    let setupDirective = () => {
        let key = Object.keys(vnode.attrs).find((k) => {
            return k.slice(0, 3) == 'ds-' && directiveRepo.has(k.slice(3));
        });
        if(!key)return Promise.resolve();
        
        let val = vnode.attrs[key];
        delete vnode.attrs[key];
        
        let directiveName = key.slice(3);
        let directive = directiveRepo.create(directiveName);
        if (directive.onbind) {
            let result = directive.onbind(vnode, val);
            if(result) {
                return result.then(() => {
                    if(!vnode.delayDeleted) {
                        return setupDirective();
                    }
                });
            }
        }
        //process next directive
        return setupDirective();
    };
    
    return setupDirective();
};

let getModuleEvalData = (module) => {
    return Object.assign({}, globalContext, module.data.global, module.data.local );
}

let getVnodeEvalData = (vnode) => {
    return Object.assign({ $parent: vnode.data.parent }, globalContext, vnode.data.global, vnode.data.local );
}

let evalHtmlAttrs = (vnode) => {
    let promises = [];
    for (let key in vnode.attrs) {
        if (key.slice(0, 3) != 'ds-' || !directiveRepo.has(key.slice(3))) {
            promises.push(evaluator.evalHtmlAttr(vnode.attrs[key], getVnodeEvalData(vnode))
                .then((val) => {
                    vnode.attrs[key] = val;
                }));
        }
    }
    return Promise.all(promises).then(() => {
        return vnode.attrs;
    });
};

let evalModuleAttrs = (vnode) => {
    let attrs = {};
    let promises = [];
    for (let key in vnode.attrs) {
        if (key.slice(0, 3) != 'ds-' || !directiveRepo.has(key.slice(3))) {
            promises.push(evaluator.evalModuleAttr(vnode.attrs[key], getVnodeEvalData(vnode))
                .then((val) => {
                    attrs[key] = val;
                }));
        }
    }
    return Promise.all(promises).then(() => {
        return attrs;
    });
};

let evalScriptVnode = (script, evalData) => {
    return evaluator.evalRawText(script.getDefaultText(), evalData)
        .then((text) => {
            script.setDefaultText(text);
        });
};

let evalStyleVnode = (style, evalData) => {
    evaluator.evalRawText(style.getDefaultText(), evalData)
        .then((text) => {
            style.setDefaultText(text);
        });
};

let isServerScriptVnode = (vnode) => {
    return (vnode.tag == 'script' &&
        vnode.attrs['runat'] && 
        vnode.attrs['runat'].toLowerCase() == 'server');
}

let appendVnodeText = (vnode, text) => {
    if(vnode.children && vnode.children.length) {
        let lastChild = vnode.children[vnode.children.length - 1];
        if(lastChild.isText()) {
            lastChild.value += text;
            return;
        }
    }
    
    vnode.appendChild(t(text));
}

function parseModule(module, content, idGen) {
    let vnode = null;
    
    // build vnode tree
    let processType = '';
    let parser = new HtmlParser.Parser({
        onprocessinginstruction: (name, data) => {
            if(!vnode) { //root level
                module.instructions = module.instructions || [];
                module.instructions.push(data);
            }
        }, 
        onopentag: (tagname, attrs) => {
            let current = h(tagname, attrs);
            
            // top vnode
            if (!vnode) {
                if (tagname == 'script') {
                    //process server script first
                    if(isServerScriptVnode(current)) {
                        processType = 'serverscript';
                        module.serverScripts = module.serverScripts || [];
                        module.serverScripts.push(current);
                    } else {
                        processType = 'script';
                        module.scripts = module.scripts || [];
                        module.scripts.push(current);
                    }
                } else if (tagname == 'style' || (tagname == 'link' && (
                    (attrs.type && attrs.type.toLowerCase().trim() == 'text/css') || 
                    (attrs.rel && attrs.rel.toLowerCase().trim() == 'stylesheet')))) {
                    processType = 'style';
                    module.styles = module.styles || [];
                    module.styles.push(current);
                } else {
                    if (!module.vnode) {
                        // one one html root tag is allowed
                        processType = 'html';
                        module.vnode = current;
                        module.id = 'mod-' + idGen.next(content);
                    }
                }
                vnode = current;
            } else {
                if (processType == 'html') {
                    //process server script first
                    if (isServerScriptVnode(current)) {
                        module.serverScripts = module.serverScripts || [];
                        module.serverScripts.push(current);
                        current.parent = vnode;
                        vnode = current;
                    } else {
                        vnode.appendChild(current);
                        vnode = current;
                    }
                }
            }
        }, 
        
        onclosetag: (tagname) => {
            if (!vnode) return;
            
            if((vnode.tag == 'script' && !vnode.attrs.src) || vnode.tag == 'style') {
                if(!vnode.hasDefaultText()) { // remove invalid script/style vnode
                    if(processType == 'serverscript') {
                        let index = module.serverScripts.indexOf(vnode);
                        if(index >= 0) {
                            module.serverScripts.splice(index, 1);
                        }
                    } else if(processType == 'script') {
                        let index = module.scripts.indexOf(vnode);
                        if(index >= 0) {
                            module.scripts.splice(index, 1);
                        }
                    } else if(processType == 'style') {
                        let index = module.styles.indexOf(vnode);
                        if(index >= 0) {
                            module.styles.splice(index, 1);
                        }
                    } else {
                        if(isServerScriptVnode(vnode)) {
                            let index = module.serverScripts.indexOf(vnode);
                            if(index >= 0) {
                                module.serverScripts.splice(index, 1);
                            }
                        } else {
                            vnode.parent.removeChild(vnode);
                        }
                    }
                }
            }
            
            if (processType == 'html' && vnode == module.vnode) {
                processType = '';
            }
            vnode = vnode.parent;
        }, 
        
        ontext: (text) => {
            if (!vnode || !text) return;
            if (vnode.tag == 'script' || vnode.tag == 'style') {
                text = text.trim();
                if(!text) return;
            }
            
            appendVnodeText(vnode, text);
        }
    });
    
    parser.write(content);
    parser.end();
}

function processServerScripts(module) {
    if(!module.serverScripts) return Promise.resolve();
    
    // todo:
    // eval server script attributes....
    
    // eval all server script text blocks and bind returned data to local data.
    let scriptPromises = [];
    module.serverScripts.forEach((script) => {
        scriptPromises.push(evaluator.evalCode(script.getDefaultText(), getModuleEvalData(module)).then((data) => {
            module.data.local = module.data.local || {};
            Object.assign(module.data.local, data);
        }));
    });
    
    return Promise.all(scriptPromises);
}

function processScripts(module) {
    if (!module.scripts) return Promise.resolve();
    
    // todo:
    // eval script attributes....
    
    //eval all script text blocks
    let scriptPromises = [];
    module.scripts.forEach((script) => {
        if(!script.attrs.src) {
            scriptPromises.push(evalScriptVnode(script, getModuleEvalData(module)));
        }
    });
    
    return Promise.all(scriptPromises);
}

function processStyles(module) {
    if (!module.styles) return Promise.resolve();
    
    // todo:
    // eval style attributes....
    
    //eval all style text blocks
    let stylePromises = [];
    module.styles.forEach((style) => {
        if(style.tag == 'style') {
            stylePromises.push(evalStyleVnode(style, getModuleEvalData(module)));
        }
    });
    
    return Promise.all(stylePromises);
}

function processVnode(module, resolver, vnode, idGen) {
    //vnode may be marked deleted by previous vnode
    if(vnode.delayDeleted) return Promise.resolve();
        
    let directiveExists = containsDirectives(vnode);
    
    // set data of vnode
    if (!vnode.data) { // directive may update data early before.
        let data = (vnode.parent ? vnode.parent.data : module.data);
        if (!directiveExists) {
            vnode.data = data;
        } else {
             //it's enough to just copy local data
            vnode.data = Object.assign({}, data);
            if(vnode.data.local) {
                vnode.data.local = Object.assign({}, vnode.data.local);
            }
            vnode.dataCopied = true;
        }
    }
    
    let mainPromise = null;
    
    // bind directives
    if (directiveExists) {
        mainPromise = bindDirectives(vnode);
    } else {
        mainPromise = Promise.resolve();
    }
    
    let isModuleVnode = (vnode.tag.slice(0, 3) == 'ds-');
    let childModuleExtData = {};
    
    return mainPromise.then(() => { //process attributes or value
        if(vnode.delayDeleted)return;
    
        let promises = [];
        
        if(vnode.isElement()) { // process attributes for element vnode
            if(isModuleVnode) {
                // convert attribute key of child module to data key by name convention(aa-bb => aaBb)
                promises.push(evalModuleAttrs(vnode).then((attrs) => {
                    for(let key in attrs) {
                        let normKey = key.replace(/-([a-z])/g, (c) => {
                            return c.slice(1).toUpperCase();
                        });
                        childModuleExtData[normKey] = attrs[key];
                    }
                }));
            } else if(vnode.tag == 'script') { //script vnode is processed directly
                if(!vnode.attrs.src) {
                    promises.push(evalScriptVnode(vnode, getVnodeEvalData(vnode)));
                }
            } else if(vnode.tag == 'style') { //style vnode is processed directly
                promises.push(evalStyleVnode(vnode, getVnodeEvalData(vnode)));
            } else {
                promises.push(evalHtmlAttrs(vnode));
            }
        } else { // process value for text vnode
            promises.push(evaluator.evalHtmlContent(vnode.value, getVnodeEvalData(vnode))
            .then((value) => {
                vnode.value = value;
            }));
        }
        
        return Promise.all(promises);
    }).then(() => { //process child module
        if (vnode.delayDeleted || !isModuleVnode) return;
        
        // parse child module
        let childModuleType = vnode.tag.slice(3);
        
        return resolver.resolve(childModuleType)
        .then((childContent) => {
            // build child module
            let childModule = {
                type: childModuleType, 
                data: { global: module.data.global, local: childModuleExtData, parent: module.data.local }
            };
            parseModule(childModule, childContent, idGen);
            return processModule(childModule, resolver, idGen);
        }).then((childModule) => {
            // replace parent vnode
            let index = vnode.parent.children.indexOf(vnode);
            vnode.parent.children.splice(index, 1, childModule.vnode);
            
            // record child module
            module.childModules = module.childModules || [];
            module.childModules.push(childModule);
        })
        .catch((err) => {
            console.log(err);
            vnode.delayDeleted = true;
        });
    }).then(() => { //process children vnodes
        if(vnode.delayDeleted || vnode.tag == 'script' || vnode.tag == 'style')return;
        
        // process children vnodes
        let children = vnode.children || [];
        let processChild = function(childIndex) {
            if(childIndex >= children.length)return Promise.resolve();
            
            let child = children[childIndex];
            return processVnode(module, resolver, child, idGen).then(() => {
                if(child.delayDeleted) {
                    children.splice(childIndex, 1);
                } else {
                    ++childIndex;
                }
                //process next child
                return processChild(childIndex);
            });
        }
        return processChild(0);
    });
}

function processModule(module, resolver, idGen) {
    
    let result;
    if(module.serverScripts) {
        result = processServerScripts(module);
    } else {
        result = Promise.resolve();
    }
    
    return result.then(() => {
        let promises = [];
    
        if (module.scripts) {
            promises.push(processScripts(module));
        }
        
        if (module.styles) {
            promises.push(processStyles(module));
        }
        
        if (module.vnode) {
            promises.push(processVnode(module, resolver, module.vnode, idGen));
        }
        
        return Promise.all(promises);
    }).then(() => {
        return module;
    });
}

/*
 * module will contains: 
 * {
 *     type: string
 *     id: string
 *     data: object
 *     instructions: string array
 *     vnode: object
 *     scripts: vnode array
 *     styles: vnode array
 *     childModules: array [ {...} ]
 *     serverScripts: vnode array
 * }
 */
module.exports = function (globalData, localData, content, resolver) {
    let entryModule = {
        type: 'ROOT', 
        data: { global: globalData, local: localData }
    };
    let idGen = new IdGenerator();
    parseModule(entryModule, content, idGen);
    return processModule(entryModule, resolver, idGen);
};
