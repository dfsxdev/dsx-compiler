/*
 * tag: string
 * attrs: object
 * text: string
 * parent: object
 * children: object array
 * data: object
 * delayDeleted: bool
 */

module.exports = function (tagname, attrs, text) {
    attrs = attrs || {};
    let normAttrs = {};
    for (let key in attrs) {
        normAttrs[key.toLowerCase().trim()] = attrs[key];
    }
    return {
        tag: tagname.toLowerCase().trim(), 
        attrs: normAttrs, 
        text: text, 
        clone() {
            let result = Object.assign({}, this);
            result.attrs = Object.assign({}, this.attrs);
            result.data = Object.assign({}, this.data);
            if (result.children) {
                for (let i = 0; i < result.children.length; ++i) {
                    result.children[i] = result.children[i].clone();
                }
            }
            return result;
        }
    };
};
