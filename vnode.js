/*
 * tag: string
 * attrs: object
 * text: string
 * parent: object
 * children: object array
 * data: object
 * dataCopied: bool
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
            result.data = (this.dataCopied && this.data ? Object.assign({}, this.data) : this.data);
            if (this.children) {
                result.children = [];
                for (let i = 0; i < this.children.length; ++i) {
                    result.children.push(this.children[i].clone());
                    result.children[i].parent = result;
                }
            }
            return result;
        }
    };
};