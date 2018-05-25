const htmltags = require('./htmltags');
const { h, t, ht } = require('./vnode');

//assign id attribute for modules if id does not exist.(unique module id is needed for further process)
function attachIdToModuleVnodes(module) {
    if(module.type != 'ROOT') {
        if(module.id && !module.vnode.attrs.id) {
            module.vnode.attrs.id = module.id;
        }
    }
    
    if(module.childModules) {
        module.childModules.forEach(childModule => {
            attachIdToModuleVnodes(childModule);
        });
    }
}

// search all scripts
//   script text block are transfomed here
function searchScripts(module, scripts) {
    if(module.scripts) {
        //merge text blocks to one block
        let blocks = [];
        module.scripts.forEach((script) => {
            if(script.attrs.src) {
                scripts.push(script);
            } else {
                blocks.push(script.getDefaultText());
            }
        });
        if(blocks.length) {
            if(module.type == 'ROOT') {
                let text = blocks.join('\n');
                scripts.push(ht('script', {
                    'type': 'text/javascript'
                }, text));
            } else {
                let text = [
                    `var __mod_${module.type} = function(__mod_id) {`, 
                    blocks.join('\n'), 
                    '};'
                ].join('\n');
                
                scripts.push(ht('script', {
                    'type': 'text/javascript', 
                    'invokejs': `__mod_${module.type}("${module.id}");`
                }, text));
            }
        }
    }
    
    if(module.childModules) {
        module.childModules.forEach(childModule => {
            searchScripts(childModule, scripts);
        });
    }
}

// merge all scripts
//   duplicate scripts are removed here
//   all script blocks are merge to one block
function mergeScripts(module) {
    let scripts = [];
    searchScripts(module, scripts);
    
    let result = [];
    let insideScriptTexts = [];
    
    scripts.forEach(script => {
        if(script.attrs.src) {
            //insert unique script link
            if(!result.find(item => item.attrs.src.trim() == script.attrs.src.trim())) {
                result.push(script);
            }
        } else {
            //insert unique script block
            if(insideScriptTexts.indexOf(script.getDefaultText()) < 0) {
                insideScriptTexts.push(script.getDefaultText());
            }
            if(script.attrs.invokejs) {
                insideScriptTexts.push(script.attrs.invokejs);
            }
        }
    });
    
    if(insideScriptTexts.length) {
        let text = '\n' + insideScriptTexts.join('\n') + '\n';
        result.push(ht('script', { 'type': 'text/javascript' }, text));
    }
    
    return result;
}

// search all styles
function searchStyles(module, styles) {
    if(module.styles) {
        module.styles.forEach((style) => {
            styles.push(style);
        });
    }
    
    if(module.childModules) {
        module.childModules.forEach(childModule => {
            searchStyles(childModule, styles);
        });
    }
}

// merge all styles
//   duplicate styles are removed here
//   all style blocks are merge to one block
function mergeStyles(module) {
    let styles = [];
    searchStyles(module, styles);
    
    let result = [];
    let insideStyleTexts = [];
    
    styles.forEach(style => {
        if(style.tag == 'link' && style.attrs.href) {
            //insert unique style link
            if(!result.find(item => item.attrs.href.trim() == style.attrs.href.trim())) {
                result.push(style);
            }
        } else if(style.tag == 'style') {
            //insert unique script block
            if(insideStyleTexts.indexOf(style.getDefaultText()) < 0) {
                insideStyleTexts.push(style.getDefaultText());
            }
        }
    });
    
    if(insideStyleTexts.length) {
        let text = '\n' + insideStyleTexts.join('\n') + '\n';
        result.push(ht('style', { 'type': 'text/css' }, text));
    }
    
    return result;
}

// insert all scripts and styles to head tag
function insertScriptAndStyleVnodes(vnode, scripts, styles) {
    if(vnode.tag != 'html') {
        throw new Error('<html> element is not found');
    }
    
    if((!scripts || !scripts.length) && 
        (!styles || !styles.length)) return;
    
    vnode.children = vnode.children || [];
    let headVnode = vnode.children.find(child => child.tag == 'head');
    if(!headVnode) {
        headVnode = h('head');
        headVnode.appendChild(t('\n'));
        vnode.appendChild(headVnode);
    }
    
    styles.forEach(style => {
        headVnode.appendChild(style);
        headVnode.appendChild(t('\n'));
    });
    scripts.forEach(script => {
        headVnode.appendChild(script);
        headVnode.appendChild(t('\n'));
    });
}

// generate vnode html
function buildVnode(vnode, htmls, indent) {
    if(vnode.isText()) {
        htmls.push(vnode.value);
        return;
    }
        
    htmls.push(`<${vnode.tag}`);
    for(let key in vnode.attrs) {
        let value = vnode.attrs[key];
        htmls.push(` ${key}="${value}"`);
    }
    if(htmltags['void'][vnode.tag]) {
        htmls.push('>');
        return;
    } else if(!vnode.children || !vnode.children.length) {
        htmls.push('>');
        if(vnode.text)htmls.push(vnode.text);
        htmls.push(`</${vnode.tag}>`);
        return;
    } else {
        htmls.push('>');
    }
    
    if(vnode.children) {
        vnode.children.forEach(child => {
            buildVnode(child, htmls, indent + 1);
        });
    }
    
    htmls.push(`</${vnode.tag}>`);
}

function buildEntryModule(entryModule) {
    let htmls = [];
    if(entryModule.instructions) {
        entryModule.instructions.forEach((instruction) => {
            htmls.push(`<${instruction}>\n`);
        });
    }
    buildVnode(entryModule.vnode, htmls, 0);
    return htmls.join('');
}

/*
 * module will contains: 
 * {
 *     type: string(invalid for entry module)
 *     id: string(invalid for entry module)
 *     data: object
 *     vnode: object
 *     script: array(invalid for entry module)
 *     style: array(invalid for entry module)
 *     childModules: array [ {...} ]
 * }
 */
// vnodes of all child modules are mounted already
module.exports = function(entryModule) {
    attachIdToModuleVnodes(entryModule);
    let scripts = mergeScripts(entryModule);
    let styles = mergeStyles(entryModule);
    insertScriptAndStyleVnodes(entryModule.vnode, scripts, styles);
    return buildEntryModule(entryModule);
};
