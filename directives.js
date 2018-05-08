const evaluator = require('./evaluator');
const globalContext = require('./global_context');

let getVnodeEvalData = (vnode) => {
    return Object.assign({ $parent: vnode.data.parent }, globalContext, vnode.data.global, vnode.data.local );
}

// directive factory
let repo = {
    'if': function () {
        return {
            onbind(vnode, val) {
                // evaluate if expression
                val = evaluator.getHtmlAttrExp(val);
                return evaluator.evalExp(val, getVnodeEvalData(vnode)).then((result) => {
                    if (!result) {
                        vnode.delayDeleted = true;
                    } else if(vnode.parent) {
                        //delete all remain condition vnodes
                        let children = vnode.parent.children;
                        let index = children.indexOf(vnode);
                        for(let i = index + 1; i < children.length; ++i) {
                            if(children[i].attrs['ds-elseif'] || children[i].attrs['ds-else']) {
                                children[i].delayDeleted = true;
                            } else if(children[i].attrs['ds-if']) {
                                break;
                            }
                        }
                    }
                });
            }
        };
    }, 
    'elseif': function () {
        return {
            onbind(vnode, val) {
                return this['if']().onbind(vnode, val);
            }
        };
    }, 
    'else': function () {
        return {
            onbind(vnode) {
                //do nothing
            }
        };
        
    }, 
    'for': function () {
        return {
            onbind(vnode, val) {
                if (!vnode.parent) {
                    return;
                }
                
                let vnodeIndex = vnode.parent.children.indexOf(vnode);
                if (vnodeIndex < 0) {
                    return;
                }
                
                // split expression by 'in' token
                val = evaluator.getHtmlAttrExp(val);
                let parts = val.split(/\s+in\s+/);
                if (parts.length < 2) {
                    return;
                }
                
                // parse item and key names.
                let temp = parts[0].split(',');
                let itemName = temp[0].trim();
                let keyName = (temp[1] ? temp[1].trim() : null);
                if (!/[a-zA-Z_](\w|_)*/.test(itemName) || 
                    (keyName && !/[a-zA-Z_](\w|_)*/.test(keyName))) {
                    return;
                }
                
                return evaluator.evalExp(parts[1], getVnodeEvalData(vnode)).then((items) => {
                    if(!items || typeof items != 'object') {
                        return;
                    }
                    
                    // clone one vnode for each item
                    for (let key in items) {
                        let item = items[key];
                        let cloneVnode = vnode.clone();
                        if(!cloneVnode.data.local) cloneVnode.data.local = {};
                        cloneVnode.data.local[itemName] = item;
                        if (keyName)cloneVnode.data.local[keyName] = key;
                        ++vnodeIndex;
                        vnode.parent.children.splice(vnodeIndex, 0, cloneVnode);
                    }
                    
                    // put forward in case this property will be cloned
                    vnode.delayDeleted = true;
                });
            }
        };
    }
};

module.exports = {
    has(key) {
        return repo.hasOwnProperty(key);
    }, 
    create(key) {
        let creator = repo[key];
        if (!creator) {
            throw new Error('directive ' + key + ' was not found');
        }
        return creator();
    }
};